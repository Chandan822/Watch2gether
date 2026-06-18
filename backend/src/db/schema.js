import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  unique,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Watch2Gether Redesigned Normalized Database Schema
 * Contains 15 tables with structured relationships, constraints, and indexes.
 */

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Friendships Table (Many-to-Many Symmetrical Join between Users)
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    friendId: uuid('friend_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'blocked'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Ensure we don't have duplicate friendship records
    uniqFriendship: unique('uniq_friendship').on(table.userId, table.friendId),
    userIdIdx: index('friendship_user_id_idx').on(table.userId),
    friendIdIdx: index('friendship_friend_id_idx').on(table.friendId),
  })
);

// 3. Friend Requests Table
export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    receiverId: uuid('receiver_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'accepted', 'declined'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqFriendRequest: unique('uniq_friend_request').on(
      table.senderId,
      table.receiverId
    ),
    senderIdx: index('friend_req_sender_idx').on(table.senderId),
    receiverIdx: index('friend_req_receiver_idx').on(table.receiverId),
  })
);

// 4. Room Types Table (Lookup Table for Room access classifications)
export const roomTypes = pgTable('room_types', {
  code: varchar('code', { length: 30 }).primaryKey(), // 'public', 'private', 'password_protected'
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
});

// 5. Room Themes Table (Preset CSS styles for visual personalization)
export const roomThemes = pgTable('room_themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  primaryColor: varchar('primary_color', { length: 7 }).notNull(), // hex color, e.g. '#6366f1'
  backgroundColor: varchar('background_color', { length: 7 }).notNull(), // e.g. '#0f172a'
  backgroundImageUrl: text('background_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Rooms Table
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    roomTypeCode: varchar('room_type_code', { length: 30 })
      .references(() => roomTypes.code)
      .notNull(),
    visibility: varchar('visibility', { length: 30 })
      .default('public')
      .notNull(), // 'public', 'private', 'password_protected'
    passwordHash: varchar('password_hash', { length: 255 }), // Used if password_protected
    ownerId: uuid('owner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    videoUrl: text('video_url'),
    videoState: varchar('video_state', { length: 20 })
      .default('paused')
      .notNull(),
    videoTime: doublePrecision('video_time').default(0).notNull(),
    themeId: uuid('theme_id').references(() => roomThemes.id, {
      onDelete: 'set null',
    }),
    isAiEnabled: boolean('is_ai_enabled').default(false).notNull(),
    sharedNotes: text('shared_notes').default('').notNull(),
    activePdfUrl: text('active_pdf_url'),
    activePdfPage: integer('active_pdf_page').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index('room_owner_idx').on(table.ownerId),
    typeIdx: index('room_type_idx').on(table.roomTypeCode),
    visibilityIdx: index('room_visibility_idx').on(table.visibility),
  })
);

// 7. Room Members Table (Many-to-Many Join between Users and Rooms)
export const roomMembers = pgTable(
  'room_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 20 }).default('member').notNull(), // 'host', 'co-host', 'member', 'guest'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqRoomMember: unique('uniq_room_member').on(table.roomId, table.userId),
    roomIdx: index('room_member_room_idx').on(table.roomId),
    userIdx: index('room_member_user_idx').on(table.userId),
  })
);

// 8. Room Invitations Table
export const roomInvitations = pgTable(
  'room_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    inviterId: uuid('inviter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    inviteeId: uuid('invitee_id').references(() => users.id, {
      onDelete: 'cascade',
    }), // Nullable for generic links
    token: varchar('token', { length: 255 }).unique().notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'accepted', 'expired'
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    roomIdx: index('room_invite_room_idx').on(table.roomId),
    inviteeIdx: index('room_invite_invitee_idx').on(table.inviteeId),
    tokenIdx: index('room_invite_token_idx').on(table.token),
  })
);

// 9. Polls Table
export const polls = pgTable(
  'polls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    question: text('question').notNull(),
    type: varchar('type', { length: 30 }).default('custom').notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    roomIdx: index('poll_room_idx').on(table.roomId),
  })
);

// 10. Poll Options Table
export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id')
      .references(() => polls.id, { onDelete: 'cascade' })
      .notNull(),
    optionText: text('option_text').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pollIdx: index('poll_option_poll_idx').on(table.pollId),
  })
);

// 11. Poll Votes Table (Many-to-Many Join with single vote restriction)
export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id')
      .references(() => polls.id, { onDelete: 'cascade' })
      .notNull(),
    optionId: uuid('option_id')
      .references(() => pollOptions.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Enforces that a single user can only vote once per poll
    uniqUserVote: unique('uniq_user_poll_vote').on(table.pollId, table.userId),
    pollIdx: index('poll_vote_poll_idx').on(table.pollId),
    optionIdx: index('poll_vote_option_idx').on(table.optionId),
  })
);

// 12. Messages Table (Replaces chat_messages)
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // Nullable for system alerts
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    roomIdx: index('message_room_idx').on(table.roomId),
    createdAtIdx: index('message_created_at_idx').on(table.createdAt),
  })
);

// 13. Notifications Table
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 30 }).notNull(), // 'friend_request', 'room_invite', 'poll_created'
    title: varchar('title', { length: 100 }).notNull(),
    content: text('content'),
    isRead: boolean('is_read').default(false).notNull(),
    referenceId: uuid('reference_id'), // points to target entity id (e.g. roomId)
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notification_user_idx').on(table.userId),
    isReadIdx: index('notification_is_read_idx').on(table.isRead),
  })
);

// 14. Video Queue Table
export const videoQueue = pgTable(
  'video_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    addedById: uuid('added_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    videoUrl: text('video_url').notNull(),
    title: varchar('title', { length: 255 }),
    duration: integer('duration'), // duration in seconds
    sortOrder: integer('sort_order').notNull(), // queue ordering hierarchy
    isPlayed: boolean('is_played').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    roomIdx: index('video_queue_room_idx').on(table.roomId),
    sortOrderIdx: index('video_queue_order_idx').on(table.sortOrder),
  })
);

// 15. Playback History Table
export const playbackHistory = pgTable(
  'playback_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    playedById: uuid('played_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    videoUrl: text('video_url').notNull(),
    title: varchar('title', { length: 255 }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
  },
  (table) => ({
    roomIdx: index('playback_history_room_idx').on(table.roomId),
  })
);

// 16. Message Reactions Table
export const messageReactions = pgTable(
  'message_reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    emoji: varchar('emoji', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqMsgReaction: unique('uniq_msg_reaction').on(
      table.messageId,
      table.userId,
      table.emoji
    ),
    messageIdx: index('msg_reaction_msg_idx').on(table.messageId),
  })
);

// 17. Session Notes Table
export const sessionNotes = pgTable(
  'session_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    content: text('content').notNull(),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    roomIdx: index('session_note_room_idx').on(table.roomId),
  })
);
