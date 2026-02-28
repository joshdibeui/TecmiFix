const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const verifyToken = (event) => {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const token = authHeader.substring(7);
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const user = verifyToken(event);
    if (!user) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'No autorizado' })
        };
    }

    // Only staff can update ticket status
    if (!user.isStaff) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Solo personal de mantenimiento puede actualizar tickets' })
        };
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { ticketId, status, notes } = JSON.parse(event.body);

        if (!ticketId || !status) {
            await client.query('ROLLBACK');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Ticket ID y estado son requeridos' })
            };
        }

        // Valid status values
        const validStatuses = ['abierto', 'en_progreso', 'cerrado'];
        if (!validStatuses.includes(status)) {
            await client.query('ROLLBACK');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Estado no válido' })
            };
        }

        // Check if ticket exists
        const ticketCheck = await client.query(
            'SELECT id, status FROM tickets WHERE id = $1',
            [ticketId]
        );

        if (ticketCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Ticket no encontrado' })
            };
        }

        const oldStatus = ticketCheck.rows[0].status;

        // Update ticket
        const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
        const updateValues = [status];

        if (status === 'cerrado') {
            updateFields.push('closed_at = CURRENT_TIMESTAMP');
        } else {
            updateFields.push('closed_at = NULL');
        }

        const updateQuery = `
            UPDATE tickets 
            SET ${updateFields.join(', ')}
            WHERE id = $${updateValues.length + 1}
            RETURNING *
        `;

        const ticketResult = await client.query(updateQuery, [...updateValues, ticketId]);

        // Create update record
        await client.query(
            `INSERT INTO ticket_updates (ticket_id, user_id, status, notes, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [ticketId, user.userId, status, notes || `Cambio de estado: ${oldStatus} → ${status}`]
        );

        await client.query('COMMIT');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: `Ticket actualizado a: ${status.replace('_', ' ')}`,
                ticket: ticketResult.rows[0]
            })
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update ticket error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error al actualizar ticket' })
        };
    } finally {
        client.release();
    }
};