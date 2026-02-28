const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper to verify JWT and return user info
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

// Generate folio: MT-YYYY-NNNN
const generateFolio = async (client) => {
    const year = new Date().getFullYear();
    const result = await client.query(
        "SELECT COUNT(*) as count FROM tickets WHERE folio LIKE $1",
        [`MT-${year}-%`]
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `MT-${year}-${count.toString().padStart(4, '0')}`;
};

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const user = verifyToken(event);
    if (!user) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'No autorizado' })
        };
    }

    // GET - List tickets
    if (event.httpMethod === 'GET') {
        try {
            const { id } = event.queryStringParameters || {};

            // Get single ticket with details
            if (id) {
                const ticketResult = await pool.query(
                    `SELECT t.*, u.name as user_name, u.email as user_email
                     FROM tickets t
                     JOIN users u ON t.user_id = u.id
                     WHERE t.id = $1`,
                    [id]
                );

                if (ticketResult.rows.length === 0) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Ticket no encontrado' })
                    };
                }

                const ticket = ticketResult.rows[0];

                // Get images
                const imagesResult = await pool.query(
                    'SELECT id, image_url, uploaded_at FROM ticket_images WHERE ticket_id = $1',
                    [id]
                );

                // Get updates
                const updatesResult = await pool.query(
                    `SELECT tu.*, u.name as user_name
                     FROM ticket_updates tu
                     LEFT JOIN users u ON tu.user_id = u.id
                     WHERE tu.ticket_id = $1
                     ORDER BY tu.created_at DESC`,
                    [id]
                );

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        ticket: {
                            ...ticket,
                            images: imagesResult.rows,
                            updates: updatesResult.rows
                        }
                    })
                };
            }

            // List all tickets (admin) or user's tickets
            let query;
            let params = [];

            if (user.isStaff) {
                // Admin sees all tickets
                query = `
                    SELECT t.*, u.name as user_name, u.email as user_email,
                           COUNT(ti.id) as image_count
                    FROM tickets t
                    JOIN users u ON t.user_id = u.id
                    LEFT JOIN ticket_images ti ON t.id = ti.ticket_id
                    GROUP BY t.id, u.name, u.email
                    ORDER BY t.created_at DESC
                `;
            } else {
                // Regular user sees only their tickets
                query = `
                    SELECT t.*, COUNT(ti.id) as image_count
                    FROM tickets t
                    LEFT JOIN ticket_images ti ON t.id = ti.ticket_id
                    WHERE t.user_id = $1
                    GROUP BY t.id
                    ORDER BY t.created_at DESC
                `;
                params = [user.userId];
            }

            const result = await pool.query(query, params);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ tickets: result.rows })
            };

        } catch (error) {
            console.error('Get tickets error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Error al obtener tickets' })
            };
        }
    }

    // POST - Create ticket
    if (event.httpMethod === 'POST') {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { department, issue_type, priority, description, images } = JSON.parse(event.body);

            // Validation
            if (!department || !issue_type || !description) {
                await client.query('ROLLBACK');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Departamento, tipo de problema y descripción son requeridos' })
                };
            }

            // Generate folio
            const folio = await generateFolio(client);

            // Insert ticket
            const ticketResult = await client.query(
                `INSERT INTO tickets (folio, user_id, issue_type, description, status, priority, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'abierto', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [folio, user.userId, issue_type, description.trim(), priority || 'medio']
            );

            const ticket = ticketResult.rows[0];

            // Insert images if provided
            if (images && images.length > 0) {
                for (const imageBase64 of images.slice(0, 3)) {
                    // In production, upload to cloud storage and get URL
                    // For now, store base64 (not recommended for production)
                    await client.query(
                        `INSERT INTO ticket_images (ticket_id, image_url, uploaded_at)
                         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
                        [ticket.id, imageBase64]
                    );
                }
            }

            // Create initial update
            await client.query(
                `INSERT INTO ticket_updates (ticket_id, user_id, status, notes, created_at)
                 VALUES ($1, $2, 'abierto', 'Ticket creado', CURRENT_TIMESTAMP)`,
                [ticket.id, user.userId]
            );

            await client.query('COMMIT');

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    message: 'Ticket creado exitosamente',
                    folio: ticket.folio,
                    ticket: ticket
                })
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create ticket error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Error al crear ticket' })
            };
        } finally {
            client.release();
        }
    }

    // GET /tickets/my-tickets - User's own tickets
    if (event.path.endsWith('/my-tickets') && event.httpMethod === 'GET') {
        try {
            const result = await pool.query(
                `SELECT t.*, COUNT(ti.id) as image_count
                 FROM tickets t
                 LEFT JOIN ticket_images ti ON t.id = ti.ticket_id
                 WHERE t.user_id = $1
                 GROUP BY t.id
                 ORDER BY t.created_at DESC`,
                [user.userId]
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ tickets: result.rows })
            };

        } catch (error) {
            console.error('Get my tickets error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Error al obtener tickets' })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};