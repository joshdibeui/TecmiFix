const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
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

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get token from header
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Token no proporcionado' })
            };
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                valid: true,
                user: {
                    id: decoded.userId,
                    email: decoded.email,
                    isStaff: decoded.isStaff
                }
            })
        };

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Token expirado' })
            };
        }

        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Token inválido' })
        };
    }
};
