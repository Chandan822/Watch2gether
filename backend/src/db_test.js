import pg from 'pg';
import { config } from './config/index.js';

console.log('🔄 Attempting database connection to Neon...');
console.log('URL domain:', config.DATABASE_URL.split('@')[1] || 'invalid');

const client = new pg.Client({
  connectionString: config.DATABASE_URL,
});

const testConn = async () => {
  try {
    const start = Date.now();
    await client.connect();
    console.log('🔌 Connected to Postgres client!');
    const res = await client.query('SELECT NOW();');
    console.log('✅ Query response:', res.rows[0]);
    console.log(`⏱️ Connection + Query took ${Date.now() - start}ms`);
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } finally {
    await client.end();
  }
};

testConn();
