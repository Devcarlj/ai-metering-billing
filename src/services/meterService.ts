import { Pool } from 'pg';

export class MeterService {
  constructor(private db: Pool) {}

  async checkQuota(tenantId: string, eventType: string, requestedQty: number) {
    const subRes = await this.db.query(
      `SELECT s.status, p.max_api_calls, p.max_ai_tokens, s.current_period_start, s.current_period_end
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.tenant_id = $1 AND s.status = 'active'
       LIMIT 1`,
      [tenantId]
    );

    if (subRes.rowCount === 0) {
      return { allowed: false, reason: 'PAYMENT_REQUIRED', status: 402, message: 'No active subscription found. Upgrade required.' };
    }

    const sub = subRes.rows[0];
    const maxAllowed = eventType === 'api_call' ? sub.max_api_calls : sub.max_ai_tokens;

    const usageRes = await this.db.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_used
       FROM usage_events
       WHERE tenant_id = $1 
         AND event_type = $2 
         AND created_at >= $3 
         AND created_at <= $4`,
      [tenantId, eventType, sub.current_period_start, sub.current_period_end]
    );

    const currentUsed = parseInt(usageRes.rows[0].total_used, 10);

    if (currentUsed + requestedQty > maxAllowed) {
      return {
        allowed: false,
        reason: 'QUOTA_EXCEEDED',
        status: 429,
        message: `Monthly quota exceeded for ${eventType}. Used: ${currentUsed}/${maxAllowed}. Requested: ${requestedQty}.`,
      };
    }

    return { allowed: true, currentUsed, maxAllowed };
  }

  async recordUsage(tenantId: string, eventType: string, quantity: number, idempotencyKey: string, payloadObj: any) {
    // 1. Serialize payload to JSON string exactly ONCE
    const rawPayloadString = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);

    // 2. Check for existing idempotency key
    const existing = await this.db.query(
      `SELECT response_payload FROM usage_events WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      // Return exact stored raw string directly from cache
      return { isDuplicate: true, rawResponse: existing.rows[0].response_payload };
    }

    // 3. Perform Quota Check
    const quotaCheck = await this.checkQuota(tenantId, eventType, quantity);
    if (!quotaCheck.allowed) {
      return { isDuplicate: false, error: quotaCheck };
    }

    // 4. Store raw string payload atomically
    await this.db.query(
      `INSERT INTO usage_events (tenant_id, event_type, quantity, idempotency_key, response_payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, eventType, quantity, idempotencyKey, rawPayloadString]
    );

    return { isDuplicate: false, rawResponse: rawPayloadString };
  }
}