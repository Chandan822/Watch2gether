import pg from 'pg';
import { config } from '../config/index.js';

const { Client } = pg;

/**
 * Database Reset Helper
 * Drops original tables to ensure drizzle-kit push can execute in non-interactive mode.
 */
const dropTables = async () => {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database to clean up old tables...');
    await client.connect();
    
    await client.query('DROP TABLE IF EXISTS chat_messages, users, rooms CASCADE;');
    console.log('✅ Old tables dropped successfully.');
  } catch (error) {
    console.error('❌ Error dropping tables:', error);
  } finally {
    await client.end();
  }
};

dropTables();
