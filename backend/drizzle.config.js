import { defineConfig } from 'drizzle-kit';
import { config } from './src/config/index.js';

/**
 * Drizzle ORM Migration & Development Configuration
 * This configuration file is used by the drizzle-kit CLI tool to 
 * generate SQL migrations, push database schema changes, and run Drizzle Studio.
 */
export default defineConfig({
  // Path to schema definitions
  schema: './src/db/schema.js',
  // Directory where generated migration files will be saved
  out: './src/db/migrations',
  // Database dialect
  dialect: 'postgresql',
  // Connection details pulled from verified configuration system
  dbCredentials: {
    url: config.DATABASE_URL,
  },
  // Print all SQL queries to console during execution
  verbose: true,
  // Ask for verification before performing dangerous operations (e.g. data loss)
  strict: true,
});
