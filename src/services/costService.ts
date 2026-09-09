import { Pool } from 'pg';
import { PRICING } from '../constants/pricing.js';

export class CostService {
  constructor(private db: Pool) {}

  async getTenantUsageSummary(tenantId: string) {
    // Fetch active subscription & plan details
    const subRes = await this.db.query(
      `SELECT s.status, p.id as plan_id, p.name as plan_name, p.max_api_calls, p.max_ai_tokens, s.current_period_start, s.current_period_end
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.tenant_id = $1 AND s.status = 'active'
       LIMIT 1`,
      [tenantId]
    );

    if (subRes.rowCount === 0) {
      return null;
    }

    const sub = subRes.rows[0];

    // Fetch usage events within active subscription period
    const usageRes = await this.db.query(
      `SELECT event_type, quantity, response_payload
       FROM usage_events
       WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [tenantId, sub.current_period_start, sub.current_period_end]
    );

    let totalApiCalls = 0;
    let totalInputTokens = 0;
    let totalCachedInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;

    for (const row of usageRes.rows) {
      if (row.event_type === 'api_call') {
        totalApiCalls += row.quantity;
      } else if (row.event_type === 'ai_tokens') {
        try {
          const payload = typeof row.response_payload === 'string' 
            ? JSON.parse(row.response_payload) 
            : row.response_payload;

          if (payload.breakdown) {
            totalInputTokens += payload.breakdown.input_tokens || 0;
            totalCachedInputTokens += payload.breakdown.cached_input_tokens || 0;
            totalOutputTokens += payload.breakdown.output_tokens || 0;
            totalReasoningTokens += payload.breakdown.reasoning_tokens || 0;
          } else {
            // Fallback if breakdown wasn't stored separately
            totalInputTokens += row.quantity;
          }
        } catch (e) {
          totalInputTokens += row.quantity;
        }
      }
    }

    // Calculate Costs
    const apiCallCost = totalApiCalls * PRICING.api_call.unit_cost_usd;
    const inputTokenCost = (totalInputTokens / 1000) * PRICING.ai_tokens.input_usd_per_1k;
    const cachedInputTokenCost = (totalCachedInputTokens / 1000) * PRICING.ai_tokens.cached_input_usd_per_1k;
    const outputTokenCost = (totalOutputTokens / 1000) * PRICING.ai_tokens.output_usd_per_1k;
    const reasoningTokenCost = (totalReasoningTokens / 1000) * PRICING.ai_tokens.reasoning_usd_per_1k;

    const totalTokenCost = inputTokenCost + cachedInputTokenCost + outputTokenCost + reasoningTokenCost;
    const totalCostUsd = apiCallCost + totalTokenCost;

    return {
      tenant_id: tenantId,
      plan: {
        id: sub.plan_id,
        name: sub.plan_name,
        max_api_calls: sub.max_api_calls,
        max_ai_tokens: sub.max_ai_tokens,
      },
      period: {
        start: sub.current_period_start,
        end: sub.current_period_end,
      },
      usage: {
        api_calls: totalApiCalls,
        ai_tokens: {
          total: totalInputTokens + totalCachedInputTokens + totalOutputTokens + totalReasoningTokens,
          input_tokens: totalInputTokens,
          cached_input_tokens: totalCachedInputTokens,
          output_tokens: totalOutputTokens,
          reasoning_tokens: totalReasoningTokens,
        },
      },
      cost_usd: {
        api_calls: Number(apiCallCost.toFixed(6)),
        ai_tokens: Number(totalTokenCost.toFixed(6)),
        total: Number(totalCostUsd.toFixed(6)),
      },
    };
  }
}