import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export async function initDb(pool: Pool) {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Run schema creation statements
    await pool.query(schemaSql);

    // Deduplicate existing subscription records before adding unique constraint
    await pool.query(`
      DELETE FROM subscriptions s1
      USING subscriptions s2
      WHERE s1.tenant_id = s2.tenant_id
        AND s1.id < s2.id;
    `);

    // Ensure subscriptions table has updated_at column and unique tenant_id constraint
    await pool.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenant_id_key'
        ) THEN
          ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);
        END IF;
      END $$;
    `);

    console.log('🚀 Database tables (tenants, plans, subscriptions, usage_events) checked/created successfully!');
  } catch (error: any) {
    console.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
}