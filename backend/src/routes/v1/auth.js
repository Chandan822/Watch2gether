import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq, or } from 'drizzle-orm';
import { validateBody } from '../../middleware/validator.js';
import { 
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  generateRefreshToken,
  verifyRefreshToken 
} from '../../services/authService.js';

const router = Router();

// Zod schema rules for registration
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

// Zod schema rules for login inputs
const loginSchema = z.object({
  username: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Options for storing the Refresh Token cookie
const REFRESH_COOKIE_OPTS = {
  httpOnly: true, // Hides cookie from client-side JS to protect against XSS
  secure: process.env.NODE_ENV === 'production', // Transmits only over HTTPS in prod
  sameSite: 'strict', // Blocks cookie transmission on cross-site requests
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration (in ms)
};

/**
 * 1. User Registration Route
 * POST /api/v1/auth/register
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if username or email is already registered in DB
    const existingUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);

    if (existingUsers.length > 0) {
      const err = new Error('Username or Email is already registered');
      err.statusCode = 409; // HTTP Conflict
      throw err;
    }

    // Hash the password securely
    const passwordHash = await hashPassword(password);

    // Save the new user record
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning();

    // Generate JWT access and refresh token strings
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Store the refresh token in the database to allow session verification
    await db
      .update(users)
      .set({ refreshToken })
      .where(eq(users.id, newUser.id));

    // Set HttpOnly refresh cookie and send access token
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    
    res.status(201).json({
      status: 'success',
      data: {
        accessToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          avatarUrl: newUser.avatarUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. User Login Route
 * POST /api/v1/auth/login
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Search user record matching username OR email address
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, username)))
      .limit(1);

    if (!user) {
      const err = new Error('Invalid login credentials');
      err.statusCode = 401; // HTTP Unauthorized
      throw err;
    }

    // Compare inputted password with stored bcrypt hash
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Invalid login credentials');
      err.statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Record refresh token in the database
    await db
      .update(users)
      .set({ refreshToken })
      .where(eq(users.id, user.id));

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    
    res.status(200).json({
      status: 'success',
      data: {
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Session Token Refresh Route
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res, _next) => {
  try {
    // Parse cookies header manually to avoid adding package dependencies
    const cookiesHeader = req.headers.cookie || '';
    const targetCookie = cookiesHeader
      .split(';')
      .find((c) => c.trim().startsWith('refreshToken='));
    
    const refreshToken = targetCookie ? targetCookie.split('=')[1].trim() : null;

    if (!refreshToken) {
      // Return 401 directly for guests visiting the site without active logins
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Session refresh token is missing',
      });
    }

    // Verify token validity
    const decoded = verifyRefreshToken(refreshToken);

    // Verify that the user exists and the token matches the database entry
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Invalid session tokens',
      });
    }

    // Sign new access and refresh tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Cycle the refresh token in the database for rotation security
    await db
      .update(users)
      .set({ refreshToken: newRefreshToken })
      .where(eq(users.id, user.id));

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTS);
    
    return res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    // Handle expired tokens cleanly without dumping full console stack traces
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Session has expired. Please login again.',
    });
  }
});

/**
 * 4. User Logout Route
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    const cookiesHeader = req.headers.cookie || '';
    const targetCookie = cookiesHeader
      .split(';')
      .find((c) => c.trim().startsWith('refreshToken='));
    
    const refreshToken = targetCookie ? targetCookie.split('=')[1].trim() : null;

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        
        // Remove token from database record on logout
        await db
          .update(users)
          .set({ refreshToken: null })
          .where(eq(users.id, decoded.id));
      } catch (err) {
        // Ignore expired or signature mismatch errors on logouts
      }
    }

    // Remove client cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
