import { verifyAccessToken } from '../services/authService.js';

/**
 * JWT Access Token Verification Middleware
 *
 * Intercepts requests destined for protected endpoints.
 * 1. Checks for the presence of the Authorization header formatted as 'Bearer <token>'.
 * 2. Decodes and verifies the access token signatures.
 * 3. Mounts the verified user payload directly on 'req.user' for downstream routes.
 * 4. Responds with HTTP 401 on missing or expired credentials.
 */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Access unauthorized: Access token is missing or invalid.',
      });
    }

    // Split the Bearer prefix and retrieve the payload token string
    const token = authHeader.split(' ')[1];

    // Validate JWT signature and expiration
    const decoded = verifyAccessToken(token);

    // Bind decoded user details to the Express request object
    req.user = decoded;

    next();
  } catch (error) {
    console.error('⚠️ Authentication check failed:', error.message);

    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Access unauthorized: Token has expired or is invalid.',
    });
  }
};

export default requireAuth;
