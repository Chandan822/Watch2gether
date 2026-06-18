import { db } from './index.js';
import { roomTypes, rooms } from './schema.js';
import { eq } from 'drizzle-orm';

/**
 * Database Seeder
 *
 * Automatically checks whether lookup tables are empty or out of sync, and populates them
 * with default configuration codes on server startup to maintain relational integrity.
 */
export const seedDatabase = async () => {
  try {
    // Check if the new categories exist (e.g. check for 'movie_night')
    const existingMovieNight = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.code, 'movie_night'))
      .limit(1);

    if (existingMovieNight.length === 0) {
      console.log('🌱 Syncing room types table. Clearing old entries...');

      // Wipe dependent tables first in development to prevent foreign key errors
      await db.delete(rooms);

      // Wipe the lookup table
      await db.delete(roomTypes);

      console.log('🌱 Seeding default room type categories...');

      await db.insert(roomTypes).values([
        {
          code: 'movie_night',
          name: 'Movie Night',
          description: 'Watch films and series with friends.',
        },
        {
          code: 'youtube_party',
          name: 'YouTube Watch Party',
          description: 'Stream YouTube videos in sync.',
        },
        {
          code: 'study_group',
          name: 'Study Group',
          description: 'Learn together with shared notes and screens.',
        },
        {
          code: 'coding_session',
          name: 'Coding Session',
          description: 'Pair program or code along in real-time.',
        },
        {
          code: 'gaming_party',
          name: 'Gaming Watch Party',
          description: 'Watch live gaming streams or gameplay clips.',
        },
        {
          code: 'music_party',
          name: 'Music Party',
          description: 'Listen to playlists and watch music videos.',
        },
        {
          code: 'community_event',
          name: 'Community Event',
          description: 'Host open discussions and virtual meetups.',
        },
        {
          code: 'custom',
          name: 'Custom Room',
          description: 'A flexible, customizable watch party lounge.',
        },
      ]);

      console.log('✅ Seeding lookup parameters complete.');
    }
  } catch (error) {
    console.error('⚠️ Database seeding warning:', error.message);
  }
};

export default seedDatabase;
