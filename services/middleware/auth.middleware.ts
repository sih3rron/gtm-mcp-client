import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware to validate API key
 * Expects: Authorization: Bearer <SERVICE_API_KEY>
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    // Skip authentication for health check endpoint
    if (req.path === '/health') {
        return next();
    }

    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing Authorization header'
        });
        return;
    }

    // Check if it follows Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid Authorization header format. Expected: Bearer <token>'
        });
        return;
    }

    const token = parts[1];
    const validApiKey = process.env.SERVICE_API_KEY;

    // Check if SERVICE_API_KEY is configured
    if (!validApiKey) {
        console.error('❌ SERVICE_API_KEY not configured in environment variables');
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'API key validation not configured'
        });
        return;
    }

    // Validate the token
    if (token !== validApiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
        });
        return;
    }

    // Token is valid, proceed to next middleware/route handler
    next();
};