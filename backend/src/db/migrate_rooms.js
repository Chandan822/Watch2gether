import pg from 'pg';
import { config } from '../config/index.js';

const { Client } = pg;

const migrateRoomsTable = async () => {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to Neon database for migration...');
    await client.connect();

    // Add visibility column if it does not exist
    console.log('adding visibility column...');
    await client.query(`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS visibility varchar(30) DEFAULT 'public' NOT NULL;
    `);

    // Add visibility index if it does not exist
    console.log('creating visibility index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS room_visibility_idx ON rooms (visibility);
    `);

    // Modify default role in room_members table if needed
    console.log('updating default role for room_members...');
    await client.query(`
      ALTER TABLE room_members 
      ALTER COLUMN role SET DEFAULT 'member';
    `);

    console.log('✅ Rooms table migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await client.end();
  }
};

migrateRoomsTable();
