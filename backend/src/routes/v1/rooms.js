import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { db } from '../../db/index.js';
import {
  rooms,
  roomMembers,
  users,
  roomInvitations,
  messages,
  messageReactions,
  friendships,
  sessionNotes,
} from '../../db/schema.js';
import { eq, and, inArray, or, desc } from 'drizzle-orm';
import { validateBody } from '../../middleware/validator.js';
import { uploadPdf, uploadVideo } from '../../middleware/upload.js';
import {
  isUserOnlineInRoom,
  onlineUsers,
  createNotification,
  aiSessions,
} from '../../services/socketService.js';
import {
  generateVideoSummary,
  generateDiscussionQuestions,
  generateQuiz,
  explainStudyTopic,
} from '../../services/geminiService.js';
import { convertToHls } from '../../services/hlsService.js';

const router = Router();

// Zod validation rules for room creation inputs
const createRoomSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Room name must be at least 3 characters')
      .max(50, 'Room name cannot exceed 50 characters')
      .trim(),
    roomTypeCode: z.enum(
      [
        'movie_night',
        'youtube_party',
        'study_group',
        'coding_session',
        'gaming_party',
        'music_party',
        'community_event',
        'custom',
      ],
      {
        errorMap: () => ({ message: 'Invalid room type code selected' }),
      }
    ),
    visibility: z
      .enum(['public', 'private', 'password_protected'])
      .default('public'),
    password: z.string().optional(),
    isAiEnabled: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (
        data.visibility === 'password_protected' &&
        (!data.password || data.password.trim() === '')
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Password is required for password protected rooms',
      path: ['password'],
    }
  );

/**
 * List Public Rooms
 * GET /api/v1/rooms
 * Returns all active rooms marked as public.
 */
router.get('/', async (req, res, next) => {
  try {
    const publicRooms = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        roomTypeCode: rooms.roomTypeCode,
        visibility: rooms.visibility,
        ownerId: rooms.ownerId,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .where(eq(rooms.visibility, 'public'));

    res.status(200).json({
      status: 'success',
      data: publicRooms,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create Room
 * POST /api/v1/rooms
 * Receives room details, validates payload, hashes password if needed, and inserts a new room & host membership.
 */
router.post('/', validateBody(createRoomSchema), async (req, res, next) => {
  try {
    const { name, roomTypeCode, visibility, password, isAiEnabled } = req.body;

    let passwordHash = null;
    if (visibility === 'password_protected' && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Insert new room using Drizzle's insert syntax
    const [newRoom] = await db
      .insert(rooms)
      .values({
        name,
        roomTypeCode,
        visibility,
        passwordHash,
        ownerId: req.user.id, // Associate the room creator as the owner
        videoState: 'paused',
        videoTime: 0,
        isAiEnabled,
      })
      .returning();

    // Insert host membership record for the creator
    await db.insert(roomMembers).values({
      roomId: newRoom.id,
      userId: req.user.id,
      role: 'host',
    });

    // Notify all active friends that user has started a room
    try {
      const creatorId = req.user.id;
      const friends = await db
        .select({
          friendId: friendships.friendId,
          userId: friendships.userId,
        })
        .from(friendships)
        .where(
          and(
            or(
              eq(friendships.userId, creatorId),
              eq(friendships.friendId, creatorId)
            ),
            eq(friendships.status, 'active')
          )
        );

      const friendIds = friends.map((f) =>
        f.userId === creatorId ? f.friendId : f.userId
      );

      for (const friendId of friendIds) {
        await createNotification({
          userId: friendId,
          type: 'friend_started_room',
          title: 'Friend Started Room',
          content: `${req.user.username} started a new watch room: "${name}".`,
          referenceId: newRoom.id,
        });
      }
    } catch (err) {
      console.error(
        '⚠️ Failed to send friend_started_room notifications:',
        err
      );
    }

    res.status(201).json({
      status: 'success',
      data: newRoom,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Join Room (Verify Password if needed)
 * POST /api/v1/rooms/:id/join
 */
router.post('/:id/join', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.id;

    // Fetch the room
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);

    if (existingMember) {
      return res.status(200).json({
        status: 'success',
        message: 'Already joined',
        data: { role: existingMember.role },
      });
    }

    // If password protected, verify password
    if (room.visibility === 'password_protected') {
      if (!password) {
        const err = new Error('Password is required to join this room');
        err.statusCode = 403;
        throw err;
      }

      const isMatch = await bcrypt.compare(password, room.passwordHash);
      if (!isMatch) {
        const err = new Error('Incorrect password');
        err.statusCode = 403;
        throw err;
      }
    }

    // Join room as member
    const [newMember] = await db
      .insert(roomMembers)
      .values({
        roomId: id,
        userId: userId,
        role: 'member',
      })
      .returning();

    res.status(200).json({
      status: 'success',
      message: 'Successfully joined room',
      data: { role: newMember.role },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Room Details
 * GET /api/v1/rooms/:id
 * Fetches a room's configuration. Restricts access to password protected rooms.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Retrieve room matching uuid parameter
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if user is already a member
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);

    // If not a member, check accessibility
    if (!member) {
      if (room.visibility === 'password_protected') {
        // Return 403 with password required code
        return res.status(403).json({
          status: 'fail',
          code: 'PASSWORD_REQUIRED',
          message: 'Password is required to join this room',
        });
      }

      // If it is a public or private room, auto-join as a member!
      await db.insert(roomMembers).values({
        roomId: id,
        userId: userId,
        role: 'member',
      });
    }

    // Refetch the role of the user (or newly created member)
    const [finalMember] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);

    res.status(200).json({
      status: 'success',
      data: {
        ...room,
        currentUserRole: finalMember?.role || 'member',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete Room
 * DELETE /api/v1/rooms/:id
 * Restricts deletion to room Hosts/Owners.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    const [member] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);

    if (room.ownerId !== userId && (!member || member.role !== 'host')) {
      const err = new Error('You do not have permission to delete this room');
      err.statusCode = 403;
      throw err;
    }

    await db.delete(rooms).where(eq(rooms.id, id));

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('room-deleted', {
        message: 'The host has deleted the room.',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Room deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Invite User to Room
 * POST /api/v1/rooms/:id/invitations
 */
router.post('/:id/invitations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username } = req.body;
    const inviterId = req.user.id;

    const [invitee] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!invitee) {
      const err = new Error(`User "${username}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [invitation] = await db
      .insert(roomInvitations)
      .values({
        roomId: id,
        inviterId,
        inviteeId: invitee.id,
        token,
        status: 'pending',
        expiresAt,
      })
      .returning();

    await createNotification({
      userId: invitee.id,
      type: 'room_invite',
      title: 'New Room Invitation',
      content: `${req.user.username} invited you to join the room: "${room.name}"`,
      referenceId: room.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('message-received', {
        id: Math.random().toString(),
        username: 'System',
        content: `${req.user.username} invited ${username} to join the party.`,
        createdAt: new Date(),
      });

      // Send real-time invitation notification direct to the invitee's sockets if they are online
      const inviteeSocketIds = onlineUsers.get(invitee.id);
      if (inviteeSocketIds) {
        inviteeSocketIds.forEach((socketId) => {
          io.to(socketId).emit('room-invitation', {
            roomId: id,
            roomName: room.name,
            inviterUsername: req.user.username,
          });
        });
      }
    }

    res.status(201).json({
      status: 'success',
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Room Member Role
 * PUT /api/v1/rooms/:id/members/:userId
 */
router.put('/:id/members/:userId', async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.id;

    if (!['host', 'co-host', 'member', 'guest'].includes(role)) {
      const err = new Error('Invalid role specified');
      err.statusCode = 400;
      throw err;
    }

    const [currentMember] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, id), eq(roomMembers.userId, currentUserId))
      )
      .limit(1);

    if (!currentMember || currentMember.role !== 'host') {
      const err = new Error('Only the Host can modify member roles');
      err.statusCode = 403;
      throw err;
    }

    const [updatedMember] = await db
      .update(roomMembers)
      .set({ role })
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .returning();

    if (!updatedMember) {
      const err = new Error('Member not found in this room');
      err.statusCode = 404;
      throw err;
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const activeMembers = await db
      .select({
        id: users.id,
        username: users.username,
        role: roomMembers.role,
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, id));

    const activeMembersWithStatus = activeMembers.map((member) => ({
      ...member,
      isOnline: isUserOnlineInRoom(member.id, id),
    }));

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('room-users-update', activeMembersWithStatus);

      io.to(id).emit('message-received', {
        id: Math.random().toString(),
        username: 'System',
        content: `"${targetUser.username}" was set to ${role} by Host.`,
        createdAt: new Date(),
      });

      io.to(id).emit('user-role-changed', { userId, role });
    }

    res.status(200).json({
      status: 'success',
      data: updatedMember,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Kick Room Member
 * DELETE /api/v1/rooms/:id/members/:userId
 */
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user.id;

    const [currentMember] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, id), eq(roomMembers.userId, currentUserId))
      )
      .limit(1);

    if (!currentMember || currentMember.role !== 'host') {
      const err = new Error('Only the Host can kick members');
      err.statusCode = 403;
      throw err;
    }

    if (currentUserId === userId) {
      const err = new Error(
        'The Host cannot kick themselves. Use Delete Room instead.'
      );
      err.statusCode = 400;
      throw err;
    }

    const [kickedMember] = await db
      .delete(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .returning();

    if (!kickedMember) {
      const err = new Error('Member not found in this room');
      err.statusCode = 404;
      throw err;
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const activeMembers = await db
      .select({
        id: users.id,
        username: users.username,
        role: roomMembers.role,
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, id));

    const activeMembersWithStatus = activeMembers.map((member) => ({
      ...member,
      isOnline: isUserOnlineInRoom(member.id, id),
    }));

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('user-kicked', { userId });
      io.to(id).emit('room-users-update', activeMembersWithStatus);

      io.to(id).emit('message-received', {
        id: Math.random().toString(),
        username: 'System',
        content: `"${targetUser.username}" was kicked from the party by Host.`,
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Member kicked successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Room Messages History
 * GET /api/v1/rooms/:id/messages
 */
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the user is a member of the room first to prevent unauthorized reads
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);

    if (!member) {
      const err = new Error('You must join the room to view message history');
      err.statusCode = 403;
      throw err;
    }

    // Fetch messages sorted chronologically
    const roomMessages = await db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        userId: messages.userId,
        content: messages.content,
        createdAt: messages.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, id))
      .orderBy(messages.createdAt);

    // Fetch reactions for these messages
    const messageIds = roomMessages.map((m) => m.id);
    let allReactions = [];
    if (messageIds.length > 0) {
      allReactions = await db
        .select({
          id: messageReactions.id,
          messageId: messageReactions.messageId,
          userId: messageReactions.userId,
          emoji: messageReactions.emoji,
          username: users.username,
        })
        .from(messageReactions)
        .innerJoin(users, eq(messageReactions.userId, users.id))
        .where(inArray(messageReactions.messageId, messageIds));
    }

    // Map reactions to their respective messages
    const reactionsMap = {};
    allReactions.forEach((reaction) => {
      if (!reactionsMap[reaction.messageId]) {
        reactionsMap[reaction.messageId] = [];
      }
      reactionsMap[reaction.messageId].push({
        userId: reaction.userId,
        username: reaction.username,
        emoji: reaction.emoji,
      });
    });

    const messagesWithReactions = roomMessages.map((msg) => ({
      ...msg,
      reactions: reactionsMap[msg.id] || [],
    }));

    res.status(200).json({
      status: 'success',
      data: messagesWithReactions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper: Retrieve room and check if user is a member & if AI is enabled.
 */
const getAiEnabledRoom = async (roomId, userId) => {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    const err = new Error('Room not found');
    err.statusCode = 404;
    throw err;
  }

  if (!room.isAiEnabled) {
    const err = new Error('AI Assistant is not enabled for this room');
    err.statusCode = 400;
    throw err;
  }

  const [member] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);

  if (!member) {
    const err = new Error(
      'You must be a member of the room to interact with the AI Assistant'
    );
    err.statusCode = 403;
    throw err;
  }

  return room;
};

/**
 * Generate Video Summary
 * POST /api/v1/rooms/:id/ai/summary
 */
router.post('/:id/ai/summary', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    await getAiEnabledRoom(roomId, req.user.id);
    const { videoTitle, videoUrl } = req.body;

    const summary = await generateVideoSummary(
      videoTitle || 'Current Video',
      videoUrl
    );

    // Save to in-memory session cache
    if (!aiSessions.has(roomId)) {
      aiSessions.set(roomId, {
        summary: null,
        questions: null,
        quiz: null,
        explanations: [],
      });
    }
    aiSessions.get(roomId).summary = summary;

    // Broadcast update to all clients in the room
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('ai-update', aiSessions.get(roomId));
    }

    res.status(200).json({ status: 'success', data: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate Discussion Questions
 * POST /api/v1/rooms/:id/ai/questions
 */
router.post('/:id/ai/questions', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    await getAiEnabledRoom(roomId, req.user.id);
    const { videoTitle, videoUrl } = req.body;

    const questions = await generateDiscussionQuestions(
      videoTitle || 'Current Video',
      videoUrl
    );

    // Save to in-memory session cache
    if (!aiSessions.has(roomId)) {
      aiSessions.set(roomId, {
        summary: null,
        questions: null,
        quiz: null,
        explanations: [],
      });
    }
    aiSessions.get(roomId).questions = questions;

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('ai-update', aiSessions.get(roomId));
    }

    res.status(200).json({ status: 'success', data: questions });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate Quiz
 * POST /api/v1/rooms/:id/ai/quiz
 */
router.post('/:id/ai/quiz', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    await getAiEnabledRoom(roomId, req.user.id);
    const { videoTitle, videoUrl } = req.body;

    const quiz = await generateQuiz(videoTitle || 'Current Video', videoUrl);

    // Save to in-memory session cache
    if (!aiSessions.has(roomId)) {
      aiSessions.set(roomId, {
        summary: null,
        questions: null,
        quiz: null,
        explanations: [],
      });
    }
    aiSessions.get(roomId).quiz = quiz;

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('ai-update', aiSessions.get(roomId));
    }

    res.status(200).json({ status: 'success', data: quiz });
  } catch (error) {
    next(error);
  }
});

/**
 * Request Study Topic Explanation
 * POST /api/v1/rooms/:id/ai/explain
 */
router.post('/:id/ai/explain', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    await getAiEnabledRoom(roomId, req.user.id);
    const { videoTitle, query } = req.body;

    if (!query || !query.trim()) {
      const err = new Error('Query text is required for study explanations');
      err.statusCode = 400;
      throw err;
    }

    const explanation = await explainStudyTopic(
      videoTitle || 'Current Video',
      query.trim()
    );

    // Save to in-memory explanations feed
    if (!aiSessions.has(roomId)) {
      aiSessions.set(roomId, {
        summary: null,
        questions: null,
        quiz: null,
        explanations: [],
      });
    }
    const explanationItem = {
      id: Math.random().toString(36).substring(2, 9),
      query: query.trim(),
      explanation,
      username: req.user.username,
      createdAt: new Date(),
    };
    aiSessions.get(roomId).explanations.push(explanationItem);

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('ai-update', aiSessions.get(roomId));
    }

    res.status(200).json({ status: 'success', data: explanationItem });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload active PDF document for Study Rooms
 * POST /api/v1/rooms/:id/pdf
 */
router.post('/:id/pdf', uploadPdf.single('pdf'), async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      const err = new Error('PDF file is required');
      err.statusCode = 400;
      throw err;
    }

    // Check room accessibility & user permissions
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member || (member.role !== 'host' && member.role !== 'co-host')) {
      const err = new Error('Only Hosts and Co-hosts can upload PDF documents');
      err.statusCode = 403;
      throw err;
    }

    // Build the PDF relative url
    const pdfUrl = `/uploads/${req.file.filename}`;

    // Update rooms database values
    await db
      .update(rooms)
      .set({
        activePdfUrl: pdfUrl,
        activePdfPage: 1,
      })
      .where(eq(rooms.id, roomId));

    // Emit socket event to notify other peers
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('pdf-url-update', { pdfUrl, page: 1 });
    }

    res.status(200).json({
      status: 'success',
      message: 'PDF uploaded successfully',
      data: { pdfUrl, page: 1 },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload local video and convert it to HLS segments
 * POST /api/v1/rooms/:id/video
 */
router.post(
  '/:id/video',
  uploadVideo.single('video'),
  async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id;

      if (!req.file) {
        const err = new Error('Video file is required');
        err.statusCode = 400;
        throw err;
      }

      // Check room accessibility & user permissions
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (!room) {
        const err = new Error('Room not found');
        err.statusCode = 404;
        throw err;
      }

      const [member] = await db
        .select()
        .from(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
        )
        .limit(1);

      if (!member || (member.role !== 'host' && member.role !== 'co-host')) {
        const err = new Error(
          'Only Hosts and Co-hosts can upload local video files'
        );
        err.statusCode = 403;
        throw err;
      }

      // Prepare output directory for HLS segments
      const timestamp = Date.now();
      const outputDirName = `hls-${roomId}-${timestamp}`;
      const outputDir = `./public/uploads/${outputDirName}`;

      const io = req.app.get('io');

      // Run background conversion
      convertToHls({
        inputPath: req.file.path,
        outputDir,
        io,
        roomId,
        onComplete: async (relativeUrl) => {
          try {
            // Update rooms database values
            await db
              .update(rooms)
              .set({
                videoUrl: relativeUrl,
                videoState: 'paused',
                videoTime: 0,
              })
              .where(eq(rooms.id, roomId));

            // Emit sync socket event to update video source in real-time
            if (io) {
              io.to(roomId).emit('video-state-change', {
                action: 'pause',
                time: 0,
                videoUrl: relativeUrl,
              });

              // Send system message
              io.to(roomId).emit('message-received', {
                id: Math.random().toString(),
                username: 'System',
                content: `A new local video was successfully processed and loaded.`,
                createdAt: new Date(),
              });
            }
          } catch (dbErr) {
            console.error(
              '⚠️ Failed to update database with HLS video URL:',
              dbErr
            );
          }
        },
        onError: (err) => {
          console.error('⚠️ Local video conversion failed:', err);
        },
      });

      res.status(200).json({
        status: 'success',
        message:
          'Video upload completed. Processing starting in the background...',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete uploaded HLS video files to free space
 * DELETE /api/v1/rooms/:id/video
 */
router.delete('/:id/video', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    // Check room accessibility & user permissions
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member || (member.role !== 'host' && member.role !== 'co-host')) {
      const err = new Error(
        'Only Hosts and Co-hosts can delete the uploaded video'
      );
      err.statusCode = 403;
      throw err;
    }

    const videoUrl = room.videoUrl;
    if (videoUrl && videoUrl.includes('/hls-')) {
      // Find output directory name
      // relativeUrl is /uploads/hls-roomId-timestamp/index.m3u8
      const urlParts = videoUrl.split('/');
      const hlsDirName = urlParts[urlParts.length - 2]; // hls-roomId-timestamp

      if (hlsDirName && hlsDirName.startsWith('hls-')) {
        const fullDirPath = `./public/uploads/${hlsDirName}`;
        try {
          if (fs.existsSync(fullDirPath)) {
            fs.rmSync(fullDirPath, { recursive: true, force: true });
            console.log(`🗑️ Deleted local HLS video directory: ${fullDirPath}`);
          }
        } catch (err) {
          console.error(`⚠️ Failed to remove HLS folder:`, err);
        }
      }
    }

    // Set videoUrl back to null
    await db
      .update(rooms)
      .set({
        videoUrl: null,
        videoState: 'paused',
        videoTime: 0,
      })
      .where(eq(rooms.id, roomId));

    // Emit sync event to update player
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('video-state-change', {
        action: 'pause',
        time: 0,
        videoUrl: null,
      });

      io.to(roomId).emit('message-received', {
        id: Math.random().toString(),
        username: 'System',
        content: `The active local video was removed by ${req.user.username}.`,
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Video files deleted and stream cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set active PDF document URL directly (e.g. public URL link)
 * PUT /api/v1/rooms/:id/pdf-url
 */
router.put('/:id/pdf-url', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const { pdfUrl } = req.body;

    if (!pdfUrl || !pdfUrl.trim()) {
      const err = new Error('PDF URL is required');
      err.statusCode = 400;
      throw err;
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      const err = new Error('Room not found');
      err.statusCode = 404;
      throw err;
    }

    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member || (member.role !== 'host' && member.role !== 'co-host')) {
      const err = new Error(
        'Only Hosts and Co-hosts can set PDF document links'
      );
      err.statusCode = 403;
      throw err;
    }

    // Update DB
    await db
      .update(rooms)
      .set({
        activePdfUrl: pdfUrl.trim(),
        activePdfPage: 1,
      })
      .where(eq(rooms.id, roomId));

    // Emit socket update
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('pdf-url-update', { pdfUrl: pdfUrl.trim(), page: 1 });
    }

    res.status(200).json({
      status: 'success',
      message: 'PDF URL set successfully',
      data: { pdfUrl: pdfUrl.trim(), page: 1 },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Room Session Notes Snapshots
 * GET /api/v1/rooms/:id/session-notes
 */
router.get('/:id/session-notes', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    // Check membership
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member) {
      const err = new Error(
        'You must be a member of this room to access session notes'
      );
      err.statusCode = 403;
      throw err;
    }

    const notes = await db
      .select({
        id: sessionNotes.id,
        title: sessionNotes.title,
        content: sessionNotes.content,
        createdById: sessionNotes.createdById,
        createdAt: sessionNotes.createdAt,
        updatedAt: sessionNotes.updatedAt,
        username: users.username,
      })
      .from(sessionNotes)
      .leftJoin(users, eq(sessionNotes.createdById, users.id))
      .where(eq(sessionNotes.roomId, roomId))
      .orderBy(desc(sessionNotes.createdAt));

    res.status(200).json({
      status: 'success',
      data: notes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Save New Session Note Snapshot
 * POST /api/v1/rooms/:id/session-notes
 */
router.post('/:id/session-notes', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const { title, content } = req.body;

    if (!title || !title.trim() || !content || !content.trim()) {
      const err = new Error(
        'Title and content are required to save session notes'
      );
      err.statusCode = 400;
      throw err;
    }

    // Check membership. Guests cannot save session notes
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member || member.role === 'guest') {
      const err = new Error(
        'Guests do not have permission to save session notes'
      );
      err.statusCode = 403;
      throw err;
    }

    const [newNote] = await db
      .insert(sessionNotes)
      .values({
        roomId,
        title: title.trim(),
        content: content.trim(),
        createdById: userId,
      })
      .returning();

    // Query username for response return
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    res.status(201).json({
      status: 'success',
      data: {
        ...newNote,
        username: userRecord?.username || 'Unknown',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete Session Note Snapshot
 * DELETE /api/v1/rooms/:id/session-notes/:noteId
 */
router.delete('/:id/session-notes/:noteId', async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const { noteId } = req.params;
    const userId = req.user.id;

    // Check permissions (Only Host/Co-host or note creator)
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))
      )
      .limit(1);

    if (!member) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const [note] = await db
      .select()
      .from(sessionNotes)
      .where(and(eq(sessionNotes.id, noteId), eq(sessionNotes.roomId, roomId)))
      .limit(1);

    if (!note) {
      const err = new Error('Session note not found');
      err.statusCode = 404;
      throw err;
    }

    const userRole = member.role;
    if (
      userRole !== 'host' &&
      userRole !== 'co-host' &&
      note.createdById !== userId
    ) {
      const err = new Error(
        'You do not have permission to delete this session note'
      );
      err.statusCode = 403;
      throw err;
    }

    await db.delete(sessionNotes).where(eq(sessionNotes.id, noteId));

    res.status(200).json({
      status: 'success',
      message: 'Session note deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
