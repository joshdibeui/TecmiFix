// In a stateless JWT system, logout is handled client-side
// This endpoint can be used for token blacklisting if needed in the future

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Client should remove token from storage
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({ message: 'Sesión cerrada exitosamente' })
    };
};