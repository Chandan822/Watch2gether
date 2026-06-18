import pg from 'pg';
import { config } from '../config/index.js';

const { Client } = pg;

/**
 * Database Table Alteration Helper
 * Runs direct ALTER queries against Neon to apply users profile schemas.
 */
const alterUsersTable = async () => {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database to alter users table...');
    await client.connect();

    // Add the new profile column if it does not exist
    await client.query(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;'
    );
    console.log('✅ avatar_url column added to users table successfully.');
  } catch (error) {
    console.error('❌ Error altering users table:', error);
  } finally {
    await client.end();
  }
};

alterUsersTable();
