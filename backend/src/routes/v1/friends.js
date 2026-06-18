import { Router } from 'express';
import { db } from '../../db/index.js';
import { friendships, friendRequests, users } from '../../db/schema.js';
import { eq, and, or } from 'drizzle-orm';
import { isUserOnline, createNotification, onlineUsers } from '../../services/socketService.js';

const router = Router();

/**
 * Get Friends List (with real-time online status checks)
 * GET /api/v1/friends
 */
router.get('/', async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Symmetrical query mapping both friendships direction sets:
    // 1. Where current user is userId (joining user details of friendId)
    const friendsAsUser = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        friendshipId: friendships.id,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(and(eq(friendships.userId, currentUserId), eq(friendships.status, 'active')));

    // 2. Where current user is friendId (joining user details of userId)
    const friendsAsFriend = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        friendshipId: friendships.id,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.userId))
      .where(and(eq(friendships.friendId, currentUserId), eq(friendships.status, 'active')));

    // Merge both arrays and append status
    const allFriends = [...friendsAsUser, ...friendsAsFriend].map(friend => ({
      ...friend,
      isOnline: isUserOnline(friend.id),
    }));

    res.status(200).json({
      status: 'success',
      data: allFriends,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Friend Requests (Sent and Received)
 * GET /api/v1/friends/requests
 */
router.get('/requests', async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Incoming requests (received)
    const received = await db
      .select({
        id: friendRequests.id,
        createdAt: friendRequests.createdAt,
        sender: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        }
      })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.senderId))
      .where(and(eq(friendRequests.receiverId, currentUserId), eq(friendRequests.status, 'pending')));

    // Outgoing requests (sent)
    const sent = await db
      .select({
        id: friendRequests.id,
        createdAt: friendRequests.createdAt,
        receiver: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        }
      })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.receiverId))
      .where(and(eq(friendRequests.senderId, currentUserId), eq(friendRequests.status, 'pending')));

    res.status(200).json({
      status: 'success',
      data: { received, sent },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Send Friend Request
 * POST /api/v1/friends/requests
 */
router.post('/requests', async (req, res, next) => {
  try {
    const { username } = req.body;
    const senderId = req.user.id;

    if (!username || !username.trim()) {
      const err = new Error('Recipient username is required');
      err.statusCode = 400;
      throw err;
    }

    // Check if recipient user profile exists
    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim()))
      .limit(1);

    if (!recipient) {
      const err = new Error(`User "${username}" not found`);
      err.statusCode = 404;
      throw err;
    }

    if (recipient.id === senderId) {
      const err = new Error('You cannot send a friend request to yourself');
      err.statusCode = 400;
      throw err;
    }

    // Check if friendship is active
    const [existingFriendship] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userId, senderId), eq(friendships.friendId, recipient.id)),
          and(eq(friendships.userId, recipient.id), eq(friendships.friendId, senderId))
        )
      )
      .limit(1);

    if (existingFriendship) {
      const err = new Error('You are already friends with this user');
      err.statusCode = 409;
      throw err;
    }

    // Check if friend request already exists
    const [existingRequest] = await db
      .select()
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, recipient.id)),
          and(eq(friendRequests.senderId, recipient.id), eq(friendRequests.receiverId, senderId))
        )
      )
      .limit(1);

    if (existingRequest) {
      const isUsSender = existingRequest.senderId === senderId;
      const err = new Error(
        isUsSender 
          ? 'You have already sent a pending friend request to this user' 
          : 'This user has already sent you a pending friend request'
      );
      err.statusCode = 409;
      throw err;
    }

    // Insert request
    const [newRequest] = await db
      .insert(friendRequests)
      .values({
        senderId,
        receiverId: recipient.id,
        status: 'pending',
      })
      .returning();

    // Create a persistent and real-time notification for the receiver
    await createNotification({
      userId: recipient.id,
      type: 'friend_request',
      title: 'New Friend Request',
      content: `${req.user.username} sent you a friend request.`,
      referenceId: newRequest.id,
    });

    const io = req.app.get('io');
    if (io) {
      const receiverSockets = onlineUsers.get(recipient.id);
      if (receiverSockets) {
        receiverSockets.forEach((socketId) => {
          io.to(socketId).emit('friends-updated');
        });
      }
    }

    res.status(201).json({
      status: 'success',
      message: 'Friend request sent successfully',
      data: newRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Accept / Reject Friend Request
 * PUT /api/v1/friends/requests/:id
 */
router.put('/requests/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const receiverId = req.user.id;

    if (!['accept', 'reject'].includes(action)) {
      const err = new Error('Invalid request action. Must be accept or reject');
      err.statusCode = 400;
      throw err;
    }

    const [request] = await db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.id, id), eq(friendRequests.receiverId, receiverId)))
      .limit(1);

    if (!request) {
      const err = new Error('Friend request not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    if (action === 'accept') {
      // Create friendship
      await db
        .insert(friendships)
        .values({
          userId: request.senderId,
          friendId: request.receiverId,
          status: 'active',
        });
    }

    // Delete request row
    await db
      .delete(friendRequests)
      .where(eq(friendRequests.id, id));

    // Emit friends-updated to both sender and receiver
    const io = req.app.get('io');
    if (io) {
      const senderSockets = onlineUsers.get(request.senderId);
      const receiverSockets = onlineUsers.get(request.receiverId);
      const allSockets = [...(senderSockets || []), ...(receiverSockets || [])];
      allSockets.forEach((socketId) => {
        io.to(socketId).emit('friends-updated');
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Friend request ${action === 'accept' ? 'accepted' : 'declined'} successfully`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Remove Friend
 * DELETE /api/v1/friends/:friendshipId
 */
router.delete('/:friendshipId', async (req, res, next) => {
  try {
    const { friendshipId } = req.params;
    const currentUserId = req.user.id;

    // Verify friendship exists and current user is participant
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(and(
        eq(friendships.id, friendshipId),
        or(eq(friendships.userId, currentUserId), eq(friendships.friendId, currentUserId))
      ))
      .limit(1);

    if (!friendship) {
      const err = new Error('Friendship not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    // Delete friendship
    await db
      .delete(friendships)
      .where(eq(friendships.id, friendshipId));

    // Emit friends-updated to both friends
    const io = req.app.get('io');
    if (io) {
      const senderSockets = onlineUsers.get(friendship.userId);
      const receiverSockets = onlineUsers.get(friendship.friendId);
      const allSockets = [...(senderSockets || []), ...(receiverSockets || [])];
      allSockets.forEach((socketId) => {
        io.to(socketId).emit('friends-updated');
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Friend removed successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
