import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Reusable Configuration System
 * 
 * We load environment variables using dotenv, then run them through a schema
 * validator (Zod) to ensure that missing or incorrect variables throw an error
 * immediately on startup rather than failing at runtime.
 */

// Load dotenv environment parameters
dotenv.config();

// Define the environment schema rules
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url({ 
    message: 'DATABASE_URL must be a valid database connection string (e.g. postgresql://...)' 
  }),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(10, { 
    message: 'JWT_ACCESS_SECRET must be a string of at least 10 characters' 
  }),
  JWT_REFRESH_SECRET: z.string().min(10, { 
    message: 'JWT_REFRESH_SECRET must be a string of at least 10 characters' 
  }),
});

// Perform validation against system env variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment configuration validation failed:');
  // Formats errors in a developer-friendly hierarchical representation
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1); // Fail immediately
}

export const config = parseResult.data;
export default config;
