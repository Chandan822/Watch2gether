import { db } from '../db/index.js';
import {
  users,
  rooms,
  messages,
  roomMembers,
  messageReactions,
  videoQueue,
  polls,
  pollOptions,
  pollVotes,
  notifications,
} from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

/**
 * Socket.IO Real-Time Service Handler
 *
 * Configures the Socket.IO connection event loop. Listens to actions sent
 * from clients, updates PostgreSQL database records using Drizzle ORM, and
 * broadcasts changes to all other connected sockets within the room.
 *
 * Redesigned to support the normalized users, messages, and roomMembers tables.
 */
let ioInstance = null;

export const createNotification = async ({
  userId,
  type,
  title,
  content,
  referenceId,
}) => {
  try {
    const [newNotif] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        title,
        content,
        referenceId,
        isRead: false,
      })
      .returning();

    // Send real-time notification direct to the user's sockets if they are online
    if (ioInstance) {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.forEach((socketId) => {
          ioInstance.to(socketId).emit('notification-received', newNotif);
        });
      }
    }
    return newNotif;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
};

export const onlineUsers = new Map(); // userId -> Set of socket.ids
export const socketToUser = new Map(); // socket.id -> userId
export const whiteboardSessions = new Map(); // roomId -> Array of drawing actions
export const aiSessions = new Map(); // roomId -> { summary, questions, quiz, explanations: [] }
export const videoProcessingStatus = new Map(); // roomId -> { status, message }

/**
 * In-memory voice channel registry.
 * voiceChannels: roomId -> Map<socketId, { userId, username }>
 * Tracks who is currently participating in the voice channel of each room.
 * This is intentionally transient — no DB persistence needed.
 */
export const voiceChannels = new Map();

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
};

export const isUserOnlineInRoom = (userId, roomId) => {
  if (!ioInstance) return false;
  const userSockets = onlineUsers.get(userId);
  if (!userSockets || userSockets.size === 0) return false;

  const socketsInRoom = ioInstance.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom || socketsInRoom.size === 0) return false;

  return [...userSockets].some((socketId) => socketsInRoom.has(socketId));
};

export const migrateHostRole = async (roomId, leavingUserId) => {
  try {
    if (!ioInstance) return;

    // 1. Fetch current members of the room
    const members = await db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));

    // Check if the leaving user is currently the host
    const leavingMember = members.find((m) => m.userId === leavingUserId);
    if (!leavingMember || leavingMember.role !== 'host') return;

    // 2. Find online candidates to promote (excluding guests and the leaving user)
    const onlineCandidates = [];
    for (const m of members) {
      if (m.userId === leavingUserId) continue;
      if (m.role === 'guest') continue;

      const online = isUserOnlineInRoom(m.userId, roomId);
      if (online) {
        onlineCandidates.push(m);
      }
    }

    if (onlineCandidates.length === 0) return;

    // Prioritize co-hosts over regular members
    onlineCandidates.sort((a, b) => {
      const score = { 'co-host': 1, 'member': 2 };
      return (score[a.role] || 3) - (score[b.role] || 3);
    });

    const candidateToPromote = onlineCandidates[0];

    // 3. Update database
    // Demote leaving host to 'member'
    await db
      .update(roomMembers)
      .set({ role: 'member' })
      .where(
        and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, leavingUserId)
        )
      );

    // Promote new host
    await db
      .update(roomMembers)
      .set({ role: 'host' })
      .where(
        and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, candidateToPromote.userId)
        )
      );

    // 4. Send socket notifications
    const [promotedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, candidateToPromote.userId))
      .limit(1);

    const [leavingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, leavingUserId))
      .limit(1);

    if (promotedUser) {
      // Emit role change updates
      ioInstance.to(roomId).emit('user-role-changed', { userId: leavingUserId, role: 'member' });
      ioInstance.to(roomId).emit('user-role-changed', { userId: candidateToPromote.userId, role: 'host' });

      // Emit system message
      ioInstance.to(roomId).emit('message-received', {
        id: Math.random().toString(),
        username: 'System',
        content: `${leavingUser?.username || 'Host'} left the room. ${promotedUser.username} is now the Host.`,
        createdAt: new Date(),
      });

      // Fetch active users in room and broadcast to all room members
      const activeMembers = await db
        .select({
          id: users.id,
          username: users.username,
          role: roomMembers.role,
        })
        .from(roomMembers)
        .innerJoin(users, eq(roomMembers.userId, users.id))
        .where(eq(roomMembers.roomId, roomId));

      const seenUserIds = new Set();
      const activeMembersWithStatus = [];
      for (const member of activeMembers) {
        if (!seenUserIds.has(member.id)) {
          seenUserIds.add(member.id);
          activeMembersWithStatus.push({
            ...member,
            isOnline: isUserOnlineInRoom(member.id, roomId),
          });
        }
      }

      ioInstance.to(roomId).emit('room-users-update', activeMembersWithStatus);
    }
  } catch (error) {
    console.error('❌ Error in migrateHostRole:', error);
  }
};

/**
 * Fetch all polls for a room along with options and votes count.
 */
export const getRoomPolls = async (roomId) => {
  try {
    const roomPolls = await db
      .select({
        id: polls.id,
        roomId: polls.roomId,
        question: polls.question,
        type: polls.type,
        isClosed: polls.isClosed,
        createdAt: polls.createdAt,
        closedAt: polls.closedAt,
        creatorUsername: users.username,
      })
      .from(polls)
      .leftJoin(users, eq(polls.creatorId, users.id))
      .where(eq(polls.roomId, roomId))
      .orderBy(desc(polls.createdAt));

    const pollsWithDetails = [];
    for (const poll of roomPolls) {
      const options = await db
        .select({
          id: pollOptions.id,
          optionText: pollOptions.optionText,
        })
        .from(pollOptions)
        .where(eq(pollOptions.pollId, poll.id));

      const votes = await db
        .select({
          id: pollVotes.id,
          optionId: pollVotes.optionId,
          userId: pollVotes.userId,
          username: users.username,
        })
        .from(pollVotes)
        .leftJoin(users, eq(pollVotes.userId, users.id))
        .where(eq(pollVotes.pollId, poll.id));

      const optionsWithVotes = options.map((opt) => {
        const optVotes = votes.filter((v) => v.optionId === opt.id);
        return {
          ...opt,
          votesCount: optVotes.length,
          voters: optVotes.map((v) => ({
            userId: v.userId,
            username: v.username,
          })),
        };
      });

      pollsWithDetails.push({
        ...poll,
        options: optionsWithVotes,
      });
    }
    return pollsWithDetails;
  } catch (error) {
    console.error('Error fetching room polls:', error);
    return [];
  }
};

export const initSocketService = (io) => {
  ioInstance = io;
  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) {
      console.log('🔌 Unauthenticated socket tried to connect, disconnecting.');
      return socket.disconnect();
    }

    console.log(`🔌 Client connected: ${socket.id} (${user.username})`);

    // Register User for Online Status Tracking
    socket.on('register-user', () => {
      const userId = user.id;
      socket.userId = userId;
      socketToUser.set(socket.id, userId);
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Emit status changed to online
      io.emit('user-status-changed', { userId, status: 'online' });
      console.log(`🟢 User registered online: ${userId}`);
    });

    // Store context for this connection session
    let currentRoomId = null;
    let currentUserId = user.id;
    let currentMemberId = null;
    let currentUsername = user.username;

    // 1. Join Room Event
    socket.on('join-room', async ({ roomId }) => {
      try {
        currentRoomId = roomId;
        const username = user.username;
        currentUsername = username;

        // Subscribes connection to room channel
        socket.join(roomId);
        console.log(`👤 User "${username}" joining room ${roomId}`);

        // Find or create the user profile record
        let [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        if (!userRecord) {
          [userRecord] = await db
            .insert(users)
            .values({ username })
            .returning();
        }

        currentUserId = userRecord.id;

        // Register user as an active room member (Many-to-Many Join)
        let [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, roomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        if (!memberRecord) {
          [memberRecord] = await db
            .insert(roomMembers)
            .values({
              roomId,
              userId: currentUserId,
              role: 'member',
            })
            .returning();
        }

        // Fetch room record to check for owner and video state
        const [roomRecord] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .limit(1);

        // Check if this joining user is the original owner/creator of the room
        if (roomRecord && currentUserId === roomRecord.ownerId) {
          // If another user was promoted to host, demote them back to member
          const otherHosts = await db
            .select()
            .from(roomMembers)
            .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.role, 'host')));

          const otherHost = otherHosts.find((m) => m.userId !== currentUserId);
          if (otherHost) {
            await db
              .update(roomMembers)
              .set({ role: 'member' })
              .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, otherHost.userId)));

            io.to(roomId).emit('user-role-changed', { userId: otherHost.userId, role: 'member' });
          }

          // Promote the owner back to host if not already
          if (memberRecord.role !== 'host') {
            const [updatedMember] = await db
              .update(roomMembers)
              .set({ role: 'host' })
              .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, currentUserId)))
              .returning();
            
            if (updatedMember) {
              memberRecord = updatedMember;
            }

            io.to(roomId).emit('user-role-changed', { userId: currentUserId, role: 'host' });

            // Send system message
            io.to(roomId).emit('message-received', {
              id: Math.random().toString(),
              username: 'System',
              content: `${username} (Original Host) has returned and resumed the Host role.`,
              createdAt: new Date(),
            });
          }
        }

        currentMemberId = memberRecord.id;

        // Check if user has other tabs/connections in this room
        const userSockets = onlineUsers.get(currentUserId) || new Set();
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
        const otherSocketsInRoom = [...userSockets].filter(
          (sid) => sid !== socket.id && socketsInRoom && socketsInRoom.has(sid)
        );
        const isAlreadyInRoom = otherSocketsInRoom.length > 0;

        // Fetch active users in room by joining roomMembers and users tables
        const activeMembers = await db
          .select({
            id: users.id,
            username: users.username,
            role: roomMembers.role,
          })
          .from(roomMembers)
          .innerJoin(users, eq(roomMembers.userId, users.id))
          .where(eq(roomMembers.roomId, roomId));

        // Deduplicate active members by userId
        const seenUserIds = new Set();
        const activeMembersWithStatus = [];
        for (const member of activeMembers) {
          if (!seenUserIds.has(member.id)) {
            seenUserIds.add(member.id);
            activeMembersWithStatus.push({
              ...member,
              isOnline: isUserOnlineInRoom(member.id, roomId),
            });
          }
        }

        io.to(roomId).emit('room-users-update', activeMembersWithStatus);

        if (!isAlreadyInRoom) {
          // Broadcast System announcement to room
          io.to(roomId).emit('message-received', {
            id: Math.random().toString(),
            username: 'System',
            content: `${username} joined the party!`,
            createdAt: new Date(),
          });
        }

        // Send current estimated video state
        if (roomRecord) {
          let estimatedTime = roomRecord.videoTime;
          if (roomRecord.videoState === 'play') {
            const elapsed =
              (Date.now() - new Date(roomRecord.updatedAt).getTime()) / 1000;
            estimatedTime += elapsed;
          }
          socket.emit('video-state-change', {
            action: roomRecord.videoState,
            time: estimatedTime,
            videoUrl: roomRecord.videoUrl,
          });
        }

        // Send initial room queue
        const queue = await db
          .select({
            id: videoQueue.id,
            videoUrl: videoQueue.videoUrl,
            title: videoQueue.title,
            duration: videoQueue.duration,
            sortOrder: videoQueue.sortOrder,
            isPlayed: videoQueue.isPlayed,
            addedByUsername: users.username,
          })
          .from(videoQueue)
          .leftJoin(users, eq(videoQueue.addedById, users.id))
          .where(
            and(eq(videoQueue.roomId, roomId), eq(videoQueue.isPlayed, false))
          )
          .orderBy(videoQueue.sortOrder);

        socket.emit('queue-update', queue);

        // Send initial room polls
        const roomPollsList = await getRoomPolls(roomId);
        socket.emit('polls-update', roomPollsList);

        // Send initial whiteboard drawing action history
        const boardHistory = whiteboardSessions.get(roomId) || [];
        socket.emit('whiteboard-init', boardHistory);

        // Send initial AI assistant session state
        if (roomRecord && roomRecord.isAiEnabled) {
          if (!aiSessions.has(roomId)) {
            aiSessions.set(roomId, {
              summary: null,
              questions: null,
              quiz: null,
              explanations: [],
            });
          }
          socket.emit('ai-init', aiSessions.get(roomId));
        }

        // Send initial video processing status if any
        if (videoProcessingStatus.has(roomId)) {
          socket.emit('video-processing', videoProcessingStatus.get(roomId));
        }

        // Send initial study mode session state
        if (roomRecord) {
          socket.emit('study-init', {
            sharedNotes: roomRecord.sharedNotes || '',
            sharedCode: roomRecord.sharedCode || '',
            sharedCodeLang: roomRecord.sharedCodeLang || 'javascript',
            activePdfUrl: roomRecord.activePdfUrl || null,
            activePdfPage: roomRecord.activePdfPage || 1,
          });
        }
      } catch (error) {
        console.error('❌ Socket join-room error:', error);
      }
    });

    // 2. Sync Video Player State (Play, Pause, Seek, Video URL change)
    socket.on('video-state-change', async ({ action, time, videoUrl }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Fetch current user's role in the room
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const userRole = memberRecord?.role || 'member';

        // Restrict video player modifications to Hosts and Co-hosts
        if (userRole !== 'host' && userRole !== 'co-host') {
          console.log(
            `🚫 Sync blocked: User "${currentUsername}" (role: "${userRole}") attempted to change video state.`
          );
          return;
        }

        console.log(
          `🎥 [Room Sync] ${currentRoomId} - Action: ${action}, Time: ${time}s, URL: ${videoUrl || 'unchanged'}`
        );

        // Save current video state to DB
        await db
          .update(rooms)
          .set({
            videoState: action,
            videoTime: time,
            ...(videoUrl !== undefined && { videoUrl }),
          })
          .where(eq(rooms.id, currentRoomId));

        // Broadcast current video state to all other players in the room
        socket.to(currentRoomId).emit('video-state-change', {
          action,
          time,
          videoUrl,
        });
      } catch (error) {
        console.error('❌ Socket video-state-change error:', error);
      }
    });

    // 3. Sync Chat Messages
    socket.on('send-message', async ({ content }) => {
      try {
        if (!currentRoomId || !currentUserId || !content) return;

        // Fetch current user's role in the room
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const userRole = memberRecord?.role || 'member';

        // Guests cannot send chat messages
        if (userRole === 'guest') {
          console.log(
            `🚫 Chat blocked: User "${currentUsername}" (role: "guest") attempted to send a message.`
          );
          return;
        }

        // Save message using the normalized schema (points to userId)
        const [newMessage] = await db
          .insert(messages)
          .values({
            roomId: currentRoomId,
            userId: currentUserId,
            content,
          })
          .returning();

        // Broadcast message to everyone in the room (including the sender)
        io.to(currentRoomId).emit('message-received', {
          id: newMessage.id,
          userId: currentUserId,
          username: currentUsername,
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          reactions: [],
        });

        // Parse mentions formatted as @username
        const mentionRegex = /@(\w+)/g;
        let match;
        const mentionedUsernames = [];
        while ((match = mentionRegex.exec(content)) !== null) {
          mentionedUsernames.push(match[1]);
        }

        if (mentionedUsernames.length > 0) {
          const mentionedUsers = await db
            .select()
            .from(users)
            .where(inArray(users.username, mentionedUsernames));

          const [roomRecord] = await db
            .select()
            .from(rooms)
            .where(eq(rooms.id, currentRoomId))
            .limit(1);

          for (const mentionedUser of mentionedUsers) {
            // Do not notify self
            if (mentionedUser.id === currentUserId) continue;

            // Check if the mentioned user is a member of the room
            const [roomMemberCheck] = await db
              .select()
              .from(roomMembers)
              .where(
                and(
                  eq(roomMembers.roomId, currentRoomId),
                  eq(roomMembers.userId, mentionedUser.id)
                )
              )
              .limit(1);

            if (roomMemberCheck) {
              await createNotification({
                userId: mentionedUser.id,
                type: 'mention',
                title: 'New Mention',
                content: `${currentUsername} mentioned you in "${roomRecord.name}".`,
                referenceId: currentRoomId,
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Socket send-message error:', error);
      }
    });

    // Handle typing status updates
    socket.on('typing-status', ({ isTyping }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('user-typing-status', {
        userId: currentUserId,
        username: currentUsername,
        isTyping,
      });
    });

    // Handle toggling reaction
    socket.on('toggle-reaction', async ({ messageId, emoji }) => {
      try {
        if (!currentRoomId || !currentUserId || !messageId || !emoji) return;

        const [existing] = await db
          .select()
          .from(messageReactions)
          .where(
            and(
              eq(messageReactions.messageId, messageId),
              eq(messageReactions.userId, currentUserId),
              eq(messageReactions.emoji, emoji)
            )
          )
          .limit(1);

        let action = 'added';
        if (existing) {
          await db
            .delete(messageReactions)
            .where(eq(messageReactions.id, existing.id));
          action = 'removed';
        } else {
          await db.insert(messageReactions).values({
            messageId,
            userId: currentUserId,
            emoji,
          });
        }

        io.to(currentRoomId).emit('reaction-updated', {
          messageId,
          emoji,
          userId: currentUserId,
          username: currentUsername,
          action,
        });
      } catch (error) {
        console.error('❌ Socket toggle-reaction error:', error);
      }
    });

    // Handle deleting a chat message (Chat Moderation)
    socket.on('delete-message', async ({ messageId }) => {
      try {
        if (!currentRoomId || !currentUserId || !messageId) return;

        // Fetch user's role in the room
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Message deletion blocked: User "${currentUsername}" (role: "${role}") attempted to delete a message.`
          );
          return;
        }

        // Verify the message exists and belongs to the current room
        const [messageRecord] = await db
          .select()
          .from(messages)
          .where(
            and(eq(messages.id, messageId), eq(messages.roomId, currentRoomId))
          )
          .limit(1);

        if (!messageRecord) {
          console.log(
            `🚫 Message deletion blocked: Message "${messageId}" does not exist in room "${currentRoomId}".`
          );
          return;
        }

        // Delete the message from the db
        await db.delete(messages).where(eq(messages.id, messageId));

        // Broadcast to all clients in the room
        io.to(currentRoomId).emit('message-deleted', { messageId });
        console.log(
          `💬 [Room Chat] ${currentRoomId} - Message "${messageId}" deleted by "${currentUsername}"`
        );
      } catch (error) {
        console.error('❌ Socket delete-message error:', error);
      }
    });

    // 6. Video Queue Management Handlers
    socket.on('add-to-queue', async ({ videoUrl }) => {
      try {
        if (!currentRoomId || !videoUrl) return;

        // Verify Host or Co-host permissions
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Add to queue blocked: User "${currentUsername}" (role: "${role}") is not host/co-host.`
          );
          return;
        }

        // Find max sortOrder for the current room
        const roomQueue = await db
          .select()
          .from(videoQueue)
          .where(eq(videoQueue.roomId, currentRoomId));

        const maxSortOrder =
          roomQueue.length > 0
            ? Math.max(...roomQueue.map((item) => item.sortOrder))
            : 0;

        // Resolve a basic title from the URL
        let title = 'Synced Video';
        try {
          const urlObj = new URL(videoUrl);
          if (
            urlObj.hostname.includes('youtube.com') ||
            urlObj.hostname.includes('youtu.be')
          ) {
            title = 'YouTube Video';
            const vParam = urlObj.searchParams.get('v');
            if (vParam) {
              title = `YouTube Video (${vParam})`;
            }
          } else {
            const pathname = urlObj.pathname;
            const lastSegment = pathname.substring(
              pathname.lastIndexOf('/') + 1
            );
            if (lastSegment) {
              title = decodeURIComponent(lastSegment);
            }
          }
        } catch (e) {
          title = 'External Video';
        }

        await db.insert(videoQueue).values({
          roomId: currentRoomId,
          addedById: currentUserId,
          videoUrl: videoUrl.trim(),
          title,
          sortOrder: maxSortOrder + 1,
          isPlayed: false,
        });

        // Fetch updated queue and broadcast to all room members
        const updatedQueue = await db
          .select({
            id: videoQueue.id,
            videoUrl: videoQueue.videoUrl,
            title: videoQueue.title,
            duration: videoQueue.duration,
            sortOrder: videoQueue.sortOrder,
            isPlayed: videoQueue.isPlayed,
            addedByUsername: users.username,
          })
          .from(videoQueue)
          .leftJoin(users, eq(videoQueue.addedById, users.id))
          .where(
            and(
              eq(videoQueue.roomId, currentRoomId),
              eq(videoQueue.isPlayed, false)
            )
          )
          .orderBy(videoQueue.sortOrder);

        io.to(currentRoomId).emit('queue-update', updatedQueue);

        // Send system chat message
        io.to(currentRoomId).emit('message-received', {
          id: Math.random().toString(),
          username: 'System',
          content: `${currentUsername} added a video to the playlist.`,
          createdAt: new Date(),
        });
      } catch (error) {
        console.error('❌ Socket add-to-queue error:', error);
      }
    });

    socket.on('remove-from-queue', async ({ queueItemId }) => {
      try {
        if (!currentRoomId || !queueItemId) return;

        // Verify Host or Co-host permissions
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Remove from queue blocked: User "${currentUsername}" (role: "${role}") is not host/co-host.`
          );
          return;
        }

        await db
          .delete(videoQueue)
          .where(
            and(
              eq(videoQueue.id, queueItemId),
              eq(videoQueue.roomId, currentRoomId)
            )
          );

        // Fetch updated queue and broadcast
        const updatedQueue = await db
          .select({
            id: videoQueue.id,
            videoUrl: videoQueue.videoUrl,
            title: videoQueue.title,
            duration: videoQueue.duration,
            sortOrder: videoQueue.sortOrder,
            isPlayed: videoQueue.isPlayed,
            addedByUsername: users.username,
          })
          .from(videoQueue)
          .leftJoin(users, eq(videoQueue.addedById, users.id))
          .where(
            and(
              eq(videoQueue.roomId, currentRoomId),
              eq(videoQueue.isPlayed, false)
            )
          )
          .orderBy(videoQueue.sortOrder);

        io.to(currentRoomId).emit('queue-update', updatedQueue);
      } catch (error) {
        console.error('❌ Socket remove-from-queue error:', error);
      }
    });

    socket.on('skip-video', async () => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Verify Host or Co-host permissions
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const userRole = memberRecord?.role || 'member';
        if (userRole !== 'host' && userRole !== 'co-host') {
          console.log(
            `🚫 Skip blocked: User "${currentUsername}" (role: "${userRole}") attempted to skip.`
          );
          return;
        }

        // Find the first unplayed item in the queue
        const [nextItem] = await db
          .select()
          .from(videoQueue)
          .where(
            and(
              eq(videoQueue.roomId, currentRoomId),
              eq(videoQueue.isPlayed, false)
            )
          )
          .orderBy(videoQueue.sortOrder)
          .limit(1);

        if (nextItem) {
          // Mark it as played in DB
          await db
            .update(videoQueue)
            .set({ isPlayed: true })
            .where(eq(videoQueue.id, nextItem.id));

          // Update room active video
          await db
            .update(rooms)
            .set({
              videoUrl: nextItem.videoUrl,
              videoState: 'play', // Skip transitions directly to playing state!
              videoTime: 0,
            })
            .where(eq(rooms.id, currentRoomId));

          // Broadcast video-state-change to all clients
          io.to(currentRoomId).emit('video-state-change', {
            action: 'play',
            time: 0,
            videoUrl: nextItem.videoUrl,
          });

          // Fetch updated queue and broadcast
          const updatedQueue = await db
            .select({
              id: videoQueue.id,
              videoUrl: videoQueue.videoUrl,
              title: videoQueue.title,
              duration: videoQueue.duration,
              sortOrder: videoQueue.sortOrder,
              isPlayed: videoQueue.isPlayed,
              addedByUsername: users.username,
            })
            .from(videoQueue)
            .leftJoin(users, eq(videoQueue.addedById, users.id))
            .where(
              and(
                eq(videoQueue.roomId, currentRoomId),
                eq(videoQueue.isPlayed, false)
              )
            )
            .orderBy(videoQueue.sortOrder);

          io.to(currentRoomId).emit('queue-update', updatedQueue);

          // Send system message
          io.to(currentRoomId).emit('message-received', {
            id: Math.random().toString(),
            username: 'System',
            content: `Host skipped to the next video: "${nextItem.title}".`,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error('❌ Socket skip-video error:', error);
      }
    });

    // Handle Study Mode Shared Notes Real-Time Sync
    socket.on('notes-update', async ({ text }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Verify membership (guests cannot write notes)
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        if (!memberRecord || memberRecord.role === 'guest') {
          console.log(
            `🚫 Notes blocked: User "${currentUsername}" (role: "${memberRecord?.role}") is guest.`
          );
          return;
        }

        // Save updated notes to database
        await db
          .update(rooms)
          .set({ sharedNotes: text })
          .where(eq(rooms.id, currentRoomId));

        // Broadcast updated notes text to other room members
        socket.to(currentRoomId).emit('notes-update', { text });
      } catch (error) {
        console.error('❌ Socket notes-update error:', error);
      }
    });

    // Handle Study Mode Shared Code Real-Time Sync
    socket.on('code-update', async ({ text, lang }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Verify membership (guests cannot write code)
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        if (!memberRecord || memberRecord.role === 'guest') {
          console.log(
            `🚫 Code blocked: User "${currentUsername}" (role: "${memberRecord?.role}") is guest.`
          );
          return;
        }

        // Save updated code and language to database
        const updateData = {};
        if (text !== undefined) updateData.sharedCode = text;
        if (lang !== undefined) updateData.sharedCodeLang = lang;

        if (Object.keys(updateData).length > 0) {
          await db
            .update(rooms)
            .set(updateData)
            .where(eq(rooms.id, currentRoomId));
        }

        // Broadcast updated code to other room members
        socket.to(currentRoomId).emit('code-update', { text, lang });
      } catch (error) {
        console.error('❌ Socket code-update error:', error);
      }
    });

    // Handle Study Mode PDF Page Sync
    socket.on('pdf-page-update', async ({ page }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Verify Host/Co-host role
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 PDF page sync blocked: User "${currentUsername}" is not host/co-host.`
          );
          return;
        }

        // Update database
        await db
          .update(rooms)
          .set({ activePdfPage: page })
          .where(eq(rooms.id, currentRoomId));

        // Broadcast updated page number to other room members
        socket.to(currentRoomId).emit('pdf-page-update', { page });
      } catch (error) {
        console.error('❌ Socket pdf-page-update error:', error);
      }
    });

    // Handle Study Mode PDF URL Sync
    socket.on('pdf-url-update', async ({ pdfUrl }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Verify Host/Co-host role
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 PDF URL change blocked: User "${currentUsername}" is not host/co-host.`
          );
          return;
        }

        // Update database (reset to page 1)
        await db
          .update(rooms)
          .set({ activePdfUrl: pdfUrl, activePdfPage: 1 })
          .where(eq(rooms.id, currentRoomId));

        // Broadcast updated PDF URL to all room members
        io.to(currentRoomId).emit('pdf-url-update', { pdfUrl, page: 1 });
      } catch (error) {
        console.error('❌ Socket pdf-url-update error:', error);
      }
    });

    // Handle Study Mode Session Notes Update Sync
    socket.on('session-notes-update', () => {
      try {
        if (!currentRoomId) return;
        // Broadcast to all other clients in the room to refresh snapshots list
        socket.to(currentRoomId).emit('session-notes-update');
      } catch (error) {
        console.error('❌ Socket session-notes-update error:', error);
      }
    });

    // 5. Explicitly Leave Room Event (without dropping global connection)
    socket.on('leave-room', async () => {
      if (currentMemberId && currentRoomId) {
        try {
          console.log(
            `👤 User "${currentUsername}" explicitly leaving room ${currentRoomId}`
          );

          // Clean up voice channel if they were in it
          const roomVoice = voiceChannels.get(currentRoomId);
          if (roomVoice && roomVoice.has(socket.id)) {
            roomVoice.delete(socket.id);
            roomVoice.forEach((_, peerSocketId) => {
              io.to(peerSocketId).emit('voice-user-left', {
                userId: currentUserId,
                socketId: socket.id,
              });
            });
            const voiceParticipants = [...roomVoice.entries()].map(([sid, info]) => ({
              socketId: sid,
              userId: info.userId,
              username: info.username,
            }));
            io.to(currentRoomId).emit('voice-participants-update', voiceParticipants);
            if (roomVoice.size === 0) voiceChannels.delete(currentRoomId);
            console.log(
              `🔇 [Voice] ${currentUsername} auto-removed from voice on leaving room ${currentRoomId}`
            );
          }

          // Migrate host role if this user is leaving and is currently the host
          await migrateHostRole(currentRoomId, currentUserId);

          // Delete all membership records for this user in this room to clear duplicates
          await db
            .delete(roomMembers)
            .where(
              and(
                eq(roomMembers.roomId, currentRoomId),
                eq(roomMembers.userId, currentUserId)
              )
            );

          const activeMembers = await db
            .select({
              id: users.id,
              username: users.username,
              role: roomMembers.role,
            })
            .from(roomMembers)
            .innerJoin(users, eq(roomMembers.userId, users.id))
            .where(eq(roomMembers.roomId, currentRoomId));

          // Deduplicate active members by userId
          const seenUserIds = new Set();
          const activeMembersWithStatus = [];
          for (const member of activeMembers) {
            if (!seenUserIds.has(member.id)) {
              seenUserIds.add(member.id);
              activeMembersWithStatus.push({
                ...member,
                isOnline: isUserOnlineInRoom(member.id, currentRoomId),
              });
            }
          }

          io.to(currentRoomId).emit(
            'room-users-update',
            activeMembersWithStatus
          );

          io.to(currentRoomId).emit('message-received', {
            id: Math.random().toString(),
            username: 'System',
            content: `${currentUsername} left the party.`,
            createdAt: new Date(),
          });

          socket.leave(currentRoomId);

          const remainingSockets = io.sockets.adapter.rooms.get(currentRoomId);
          if (!remainingSockets || remainingSockets.size === 0) {
            whiteboardSessions.delete(currentRoomId);
            aiSessions.delete(currentRoomId);
            console.log(
              `🧹 In-memory whiteboard and AI sessions cleared for room ${currentRoomId} (all left via leave-room).`
            );
          }
        } catch (error) {
          console.error('❌ Socket leave-room error:', error);
        } finally {
          currentRoomId = null;
          currentMemberId = null;
        }
      }
    });

    // 3.5. Room Polls Handlers
    socket.on('create-poll', async ({ question, type, options }) => {
      try {
        if (!currentRoomId || !currentUserId) return;
        if (
          !question ||
          !options ||
          !Array.isArray(options) ||
          options.length < 2
        ) {
          console.log(
            '🚫 Create poll failed: Question or options missing or invalid.'
          );
          return;
        }

        // Check if user is host/co-host
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Create poll blocked: User "${currentUsername}" is not host/co-host.`
          );
          return;
        }

        // Insert poll
        const [newPoll] = await db
          .insert(polls)
          .values({
            roomId: currentRoomId,
            creatorId: currentUserId,
            question: question.trim(),
            type: type || 'custom',
          })
          .returning();

        // Insert options
        for (const optText of options) {
          if (!optText.trim()) continue;
          await db.insert(pollOptions).values({
            pollId: newPoll.id,
            optionText: optText.trim(),
          });
        }

        // Fetch updated polls and broadcast
        const updatedPolls = await getRoomPolls(currentRoomId);
        io.to(currentRoomId).emit('polls-update', updatedPolls);
        console.log(
          `🗳️ [Room Polls] ${currentRoomId} - Poll created by "${currentUsername}": "${question}"`
        );
      } catch (error) {
        console.error('❌ Socket create-poll error:', error);
      }
    });

    socket.on('vote-poll', async ({ pollId, optionId }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // 1. Check if poll exists and is open
        const [pollRecord] = await db
          .select()
          .from(polls)
          .where(and(eq(polls.id, pollId), eq(polls.roomId, currentRoomId)))
          .limit(1);

        if (!pollRecord || pollRecord.isClosed) {
          console.log(`🚫 Vote blocked: Poll does not exist or is closed.`);
          return;
        }

        // 2. Check if option belongs to this poll
        const [optionRecord] = await db
          .select()
          .from(pollOptions)
          .where(
            and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId))
          )
          .limit(1);

        if (!optionRecord) {
          console.log(`🚫 Vote blocked: Option does not belong to poll.`);
          return;
        }

        // 3. Check if user already voted in this poll
        const [existingVote] = await db
          .select()
          .from(pollVotes)
          .where(
            and(
              eq(pollVotes.pollId, pollId),
              eq(pollVotes.userId, currentUserId)
            )
          )
          .limit(1);

        if (existingVote) {
          if (existingVote.optionId === optionId) {
            // Clicked same option -> retract vote
            await db.delete(pollVotes).where(eq(pollVotes.id, existingVote.id));
            console.log(
              `🗳️ [Room Polls] ${currentRoomId} - User "${currentUsername}" retracted vote.`
            );
          } else {
            // Clicked different option -> update vote
            await db
              .update(pollVotes)
              .set({ optionId })
              .where(eq(pollVotes.id, existingVote.id));
            console.log(
              `🗳️ [Room Polls] ${currentRoomId} - User "${currentUsername}" changed vote to "${optionRecord.optionText}".`
            );
          }
        } else {
          // No prior vote -> insert new vote
          await db.insert(pollVotes).values({
            pollId,
            optionId,
            userId: currentUserId,
          });
          console.log(
            `🗳️ [Room Polls] ${currentRoomId} - User "${currentUsername}" voted for "${optionRecord.optionText}".`
          );
        }

        // Fetch updated polls and broadcast
        const updatedPolls = await getRoomPolls(currentRoomId);
        io.to(currentRoomId).emit('polls-update', updatedPolls);
      } catch (error) {
        console.error('❌ Socket vote-poll error:', error);
      }
    });

    socket.on('close-poll', async ({ pollId }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Check if user is host/co-host
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Close poll blocked: User "${currentUsername}" is not host/co-host.`
          );
          return;
        }

        await db
          .update(polls)
          .set({ isClosed: true, closedAt: new Date() })
          .where(and(eq(polls.id, pollId), eq(polls.roomId, currentRoomId)));

        const updatedPolls = await getRoomPolls(currentRoomId);
        io.to(currentRoomId).emit('polls-update', updatedPolls);
        console.log(
          `🗳️ [Room Polls] ${currentRoomId} - Poll "${pollId}" closed by "${currentUsername}"`
        );
      } catch (error) {
        console.error('❌ Socket close-poll error:', error);
      }
    });

    socket.on('delete-poll', async ({ pollId }) => {
      try {
        if (!currentRoomId || !currentUserId) return;

        // Check if user is host/co-host
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role !== 'host' && role !== 'co-host') {
          console.log(
            `🚫 Delete poll blocked: User "${currentUsername}" is not host/co-host.`
          );
          return;
        }

        await db
          .delete(polls)
          .where(and(eq(polls.id, pollId), eq(polls.roomId, currentRoomId)));

        const updatedPolls = await getRoomPolls(currentRoomId);
        io.to(currentRoomId).emit('polls-update', updatedPolls);
        console.log(
          `🗳️ [Room Polls] ${currentRoomId} - Poll "${pollId}" deleted by "${currentUsername}"`
        );
      } catch (error) {
        console.error('❌ Socket delete-poll error:', error);
      }
    });

    // ── Collaborative Whiteboard Handlers ─────────────────────────────────────
    socket.on('whiteboard-init', ({ roomId }) => {
      try {
        const boardHistory = whiteboardSessions.get(roomId) || [];
        socket.emit('whiteboard-init', boardHistory);
      } catch (error) {
        console.error('❌ Socket whiteboard-init error:', error);
      }
    });

    socket.on('whiteboard-action', (action) => {
      try {
        if (!currentRoomId) return;

        if (!whiteboardSessions.has(currentRoomId)) {
          whiteboardSessions.set(currentRoomId, []);
        }
        whiteboardSessions.get(currentRoomId).push(action);

        // Broadcast drawing action to all other attendees in the room
        socket.to(currentRoomId).emit('whiteboard-action', action);
      } catch (error) {
        console.error('❌ Socket whiteboard-action error:', error);
      }
    });

    socket.on('whiteboard-undo', ({ strokeId }) => {
      try {
        if (!currentRoomId || !strokeId) return;

        if (whiteboardSessions.has(currentRoomId)) {
          const updated = whiteboardSessions.get(currentRoomId).filter(
            (action) => action.strokeId !== strokeId
          );
          whiteboardSessions.set(currentRoomId, updated);
        }

        io.to(currentRoomId).emit('whiteboard-undo', { strokeId });
      } catch (error) {
        console.error('❌ Socket whiteboard-undo error:', error);
      }
    });

    socket.on('whiteboard-redo', (actions) => {
      try {
        if (!currentRoomId || !actions || !Array.isArray(actions)) return;

        if (!whiteboardSessions.has(currentRoomId)) {
          whiteboardSessions.set(currentRoomId, []);
        }
        whiteboardSessions.get(currentRoomId).push(...actions);

        // Broadcast redone actions to other attendees in the room
        socket.to(currentRoomId).emit('whiteboard-redo', actions);
      } catch (error) {
        console.error('❌ Socket whiteboard-redo error:', error);
      }
    });

    socket.on('whiteboard-clear', async () => {
      try {
        if (!currentRoomId) return;

        // Verify that the user has host, co-host, or member status to clear the canvas (guests cannot clear)
        const [memberRecord] = await db
          .select()
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, currentRoomId),
              eq(roomMembers.userId, currentUserId)
            )
          )
          .limit(1);

        const role = memberRecord?.role || 'member';
        if (role === 'guest') {
          console.log(
            `🚫 Whiteboard clear blocked: User "${currentUsername}" is guest.`
          );
          return;
        }

        whiteboardSessions.set(currentRoomId, []);
        io.to(currentRoomId).emit('whiteboard-clear');
        console.log(
          `🎨 [Whiteboard] Room "${currentRoomId}" canvas cleared by "${currentUsername}"`
        );
      } catch (error) {
        console.error('❌ Socket whiteboard-clear error:', error);
      }
    });

    // ── Voice Chat Signaling Relay ──────────────────────────────────────────
    // The server never processes SDP/ICE; it only relays between peers.

    /**
     * voice-join: User wants to enter the voice channel for the current room.
     * 1. Register them in voiceChannels[roomId]
     * 2. Broadcast updated participant list to the whole room
     * 3. Notify existing voice peers so THEY initiate offers toward the newcomer
     */
    socket.on('voice-join', () => {
      if (!currentRoomId) return;

      if (!voiceChannels.has(currentRoomId)) {
        voiceChannels.set(currentRoomId, new Map());
      }

      const roomVoice = voiceChannels.get(currentRoomId);

      // Limit check: Max 6 users
      if (roomVoice.size >= 6 && !roomVoice.has(socket.id)) {
        socket.emit('voice-error', { message: 'Voice chat is full (maximum 6 participants).' });
        return;
      }

      // Tell every existing voice participant about the new peer so they can
      // initiate an RTCPeerConnection offer toward them.
      roomVoice.forEach((peerInfo, peerSocketId) => {
        io.to(peerSocketId).emit('voice-user-joined', {
          userId: currentUserId,
          username: currentUsername,
          socketId: socket.id,
        });
      });

      // Register newcomer
      roomVoice.set(socket.id, {
        userId: currentUserId,
        username: currentUsername,
      });

      // Broadcast updated participant list to the whole room (not just voice)
      const participants = [...roomVoice.entries()].map(([sid, info]) => ({
        socketId: sid,
        userId: info.userId,
        username: info.username,
      }));
      io.to(currentRoomId).emit('voice-participants-update', participants);

      console.log(
        `🎤 [Voice] ${currentUsername} joined voice in room ${currentRoomId} (${roomVoice.size} total)`
      );
    });

    /**
     * voice-leave: User is explicitly leaving the voice channel.
     */
    socket.on('voice-leave', () => {
      if (!currentRoomId) return;
      const roomVoice = voiceChannels.get(currentRoomId);
      if (!roomVoice) return;

      roomVoice.delete(socket.id);

      // Notify remaining voice participants to tear down their peer connection
      roomVoice.forEach((_, peerSocketId) => {
        io.to(peerSocketId).emit('voice-user-left', {
          userId: currentUserId,
          socketId: socket.id,
        });
      });

      // Broadcast updated participant list
      const participants = [...roomVoice.entries()].map(([sid, info]) => ({
        socketId: sid,
        userId: info.userId,
        username: info.username,
      }));
      io.to(currentRoomId).emit('voice-participants-update', participants);

      if (roomVoice.size === 0) voiceChannels.delete(currentRoomId);
      console.log(
        `🔇 [Voice] ${currentUsername} left voice in room ${currentRoomId}`
      );
    });

    /**
     * voice-offer: Relay an SDP offer to a specific peer socket.
     * Payload: { to: socketId, offer: RTCSessionDescriptionInit }
     */
    socket.on('voice-offer', ({ to, offer }) => {
      io.to(to).emit('voice-offer', { from: socket.id, offer });
    });

    /**
     * voice-answer: Relay an SDP answer back to the offering peer.
     * Payload: { to: socketId, answer: RTCSessionDescriptionInit }
     */
    socket.on('voice-answer', ({ to, answer }) => {
      io.to(to).emit('voice-answer', { from: socket.id, answer });
    });

    /**
     * voice-ice-candidate: Relay an ICE candidate to a specific peer.
     * Payload: { to: socketId, candidate: RTCIceCandidateInit }
     */
    socket.on('voice-ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('voice-ice-candidate', { from: socket.id, candidate });
    });

    // ── End Voice Chat Signaling ─────────────────────────────────────────────

    // 4. Handle Disconnect / Connection drop
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      // Clean up global online tracking
      const userId = socket.userId || socketToUser.get(socket.id);
      if (userId) {
        const sockets = onlineUsers.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(userId);
            io.emit('user-status-changed', { userId, status: 'offline' });
            console.log(`🔴 User went offline: ${userId}`);
          }
        }
      }
      socketToUser.delete(socket.id);

      // Auto-cleanup voice channel on unexpected disconnect
      if (currentRoomId) {
        const roomVoice = voiceChannels.get(currentRoomId);
        if (roomVoice && roomVoice.has(socket.id)) {
          roomVoice.delete(socket.id);
          roomVoice.forEach((_, peerSocketId) => {
            io.to(peerSocketId).emit('voice-user-left', {
              userId: currentUserId,
              socketId: socket.id,
            });
          });
          const participants = [...roomVoice.entries()].map(([sid, info]) => ({
            socketId: sid,
            userId: info.userId,
            username: info.username,
          }));
          io.to(currentRoomId).emit('voice-participants-update', participants);
          if (roomVoice.size === 0) voiceChannels.delete(currentRoomId);
        }
      }

      if (currentRoomId && currentUserId) {
        try {
          // Migrate host role if this user was the host and is disconnecting
          await migrateHostRole(currentRoomId, currentUserId);

          // Do NOT delete the roomMembers record!
          const isStillOnlineInRoom = isUserOnlineInRoom(
            currentUserId,
            currentRoomId
          );

          // Fetch updated room users and emit
          const activeMembers = await db
            .select({
              id: users.id,
              username: users.username,
              role: roomMembers.role,
            })
            .from(roomMembers)
            .innerJoin(users, eq(roomMembers.userId, users.id))
            .where(eq(roomMembers.roomId, currentRoomId));

          // Deduplicate active members by userId
          const seenUserIds = new Set();
          const activeMembersWithStatus = [];
          for (const member of activeMembers) {
            if (!seenUserIds.has(member.id)) {
              seenUserIds.add(member.id);
              activeMembersWithStatus.push({
                ...member,
                isOnline: isUserOnlineInRoom(member.id, currentRoomId),
              });
            }
          }

          io.to(currentRoomId).emit(
            'room-users-update',
            activeMembersWithStatus
          );

          if (!isStillOnlineInRoom) {
            // Broadcast user went offline
            io.to(currentRoomId).emit('message-received', {
              id: Math.random().toString(),
              username: 'System',
              content: `${currentUsername} went offline.`,
              createdAt: new Date(),
            });
          }

          // If room has no active sockets left, clean up the whiteboard session history to free up memory
          const remainingSockets = io.sockets.adapter.rooms.get(currentRoomId);
          if (!remainingSockets || remainingSockets.size === 0) {
            whiteboardSessions.delete(currentRoomId);
            aiSessions.delete(currentRoomId);
            console.log(
              `🧹 In-memory whiteboard and AI sessions cleared for room ${currentRoomId} (all left via disconnect).`
            );
          }
        } catch (error) {
          console.error('❌ Socket disconnect cleanup error:', error);
        }
      }
    });
  });
};
