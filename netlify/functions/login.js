const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Correo y contraseña requeridos' })
            };
        }

        // Find user
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.password_hash, 
                    ms.id as staff_id, ms.specialty, ms.is_active as is_staff
             FROM users u
             LEFT JOIN maintenance_staff ms ON u.id = ms.user_id AND ms.is_active = true
             WHERE u.email = $1`,
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Credenciales inválidas' })
            };
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Credenciales inválidas' })
            };
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                isStaff: !!user.is_staff
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                message: 'Inicio de sesión exitoso',
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: !!user.is_staff ? 'admin' : 'user',
                    is_staff: !!user.is_staff,
                    specialty: user.specialty
                }
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error interno del servidor' })
        };
    }
};