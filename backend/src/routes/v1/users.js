import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validator.js';
import { upload } from '../../middleware/upload.js';
import { comparePassword, hashPassword } from '../../services/authService.js';

const router = Router();

// Zod schema rules for editing profile details
const updateProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores')
    .optional(),
  email: z.string().email('Invalid email address format').optional(),
});

// Zod schema rules for password changes
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

// Enforce authentication on all profile routes
router.use(requireAuth);

/**
 * 1. View Profile
 * GET /api/v1/users/profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      const err = new Error('User profile not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Edit Profile Details
 * PUT /api/v1/users/profile
 */
router.put('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const { username, email } = req.body;
    
    // Prevent empty requests
    if (!username && !email) {
      const err = new Error('No profile parameters provided for update');
      err.statusCode = 400;
      throw err;
    }

    // Verify username conflicts if changing username
    if (username) {
      const conflictUsers = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (conflictUsers.length > 0 && conflictUsers[0].id !== req.user.id) {
        const err = new Error('Username is already taken');
        err.statusCode = 409;
        throw err;
      }
    }

    // Update the profile fields
    const [updatedUser] = await db
      .update(users)
      .set({
        ...(username && { username: username.trim() }),
        ...(email && { email: email.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id))
      .returning();

    res.status(200).json({
      status: 'success',
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Change Password
 * PUT /api/v1/users/profile/password
 */
router.put('/profile/password', validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Fetch stored credentials
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      const err = new Error('User profile session invalid');
      err.statusCode = 404;
      throw err;
    }

    // Verify old password against database bcrypt hash
    const isMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Current password is incorrect');
      err.statusCode = 400;
      throw err;
    }

    // Generate hash for new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update hash in database
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 4. Upload Avatar
 * POST /api/v1/users/profile/avatar
 */
router.post('/profile/avatar', (req, res, next) => {
  // Capture Multer exception hooks before route processing
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: err.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Please provide an image file to upload',
        });
      }

      // Convert disk path into Base64 Data URL
      const filePath = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const base64Image = fileBuffer.toString('base64');
      const base64DataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Query current user to fetch and delete old local avatar file if it exists
      const [currentUser] = await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (currentUser && currentUser.avatarUrl) {
        // If it was a local path on disk, remove it
        if (!currentUser.avatarUrl.startsWith('http') && !currentUser.avatarUrl.startsWith('data:')) {
          const oldFilePath = `./public${currentUser.avatarUrl}`;
          fs.unlink(oldFilePath, (err) => {
            if (err) console.warn(`Could not delete old avatar: ${oldFilePath}`, err.message);
          });
        }
      }

      // Delete the newly uploaded temp file from disk immediately
      fs.unlink(filePath, (err) => {
        if (err) console.warn(`Could not delete temp uploaded file: ${filePath}`, err.message);
      });

      // Update user record in database with the base64 URL
      await db
        .update(users)
        .set({ avatarUrl: base64DataUrl, updatedAt: new Date() })
        .where(eq(users.id, req.user.id));

      res.status(200).json({
        status: 'success',
        data: {
          avatarUrl: base64DataUrl,
        },
      });
    } catch (error) {
      // Clean up temp file on failure
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  });
});

/**
 * 5. Remove Avatar
 * DELETE /api/v1/users/profile/avatar
 */
router.delete('/profile/avatar', async (req, res, next) => {
  try {
    // Query current user to fetch filename
    const [user] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (user && user.avatarUrl) {
      // If the avatar is local disk path, remove it
      if (!user.avatarUrl.startsWith('http') && !user.avatarUrl.startsWith('data:')) {
        const filePath = `./public${user.avatarUrl}`;
        fs.unlink(filePath, (err) => {
          if (err) {
            console.warn(`Could not delete avatar file from disk: ${filePath}`, err.message);
          }
        });
      }
    }

    // Set avatarUrl to null in DB
    await db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));

    res.status(200).json({
      status: 'success',
      message: 'Avatar removed successfully',
      data: {
        avatarUrl: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
