import { Pool } from 'pg';

export async function seedTestData(pool: Pool) {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  // 1. Insert Test Tenant
  await pool.query(`
    INSERT INTO tenants (id, name, stripe_customer_id)
    VALUES ($1, 'Test Tenant', 'cus_test123')
    ON CONFLICT (id) DO NOTHING;
  `, [tenantId]);

  // 2. Insert Active Free Subscription
  await pool.query(`
    INSERT INTO subscriptions (tenant_id, plan_id, status)
    VALUES ($1, 'free', 'active')
    ON CONFLICT DO NOTHING;
  `, [tenantId]);

  console.log(`✅ Seeded test tenant (${tenantId}) with active 'free' plan.`);
}