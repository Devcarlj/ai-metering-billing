import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export async function initDb(pool: Pool) {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Run schema creation statements
    await pool.query(schemaSql);
    console.log('🚀 Database tables (tenants, plans, subscriptions, usage_events) checked/created successfully!');
  } catch (error: any) {
    console.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
}