// In a stateless JWT system, logout is handled client-side
// This endpoint can be used for token blacklisting if needed in the future

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

    // Client should remove token from storage
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Sesión cerrada exitosamente' })
    };
};