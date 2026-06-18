import { Router } from 'express';
import { db } from '../../db/index.js';
import { notifications } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

/**
 * Fetch Notifications
 * GET /api/v1/notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    res.status(200).json({
      status: 'success',
      data: notifs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark Single Notification as Read
 * PUT /api/v1/notifications/:id/read
 */
router.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      const err = new Error('Notification not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark All Notifications as Read
 * PUT /api/v1/notifications/read-all
 */
router.put('/read-all', async (req, res, next) => {
  try {
    const userId = req.user.id;

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete Single Notification
 * DELETE /api/v1/notifications/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [deleted] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!deleted) {
      const err = new Error('Notification not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear All Notifications
 * DELETE /api/v1/notifications
 */
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));

    res.status(200).json({
      status: 'success',
      message: 'All notifications cleared successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
