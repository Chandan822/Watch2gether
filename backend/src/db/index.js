import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/index.js';
import * as schema from './schema.js';

const { Pool } = pg;

/**
 * Database client bootstrap
 * We create a connection Pool with pg to reuse connections.
 * The pool configuration uses the validated DATABASE_URL environment parameter.
 */
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

// Configure and export the Drizzle ORM client instance loaded with table schemas
export const db = drizzle(pool, { schema });
export default db;
