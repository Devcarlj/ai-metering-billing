export const PRICING = {
  api_call: {
    unit_cost_usd: 0.001, // $0.001 per API call
  },
  ai_tokens: {
    input_usd_per_1k: 0.00015,       // $0.15 per 1M tokens ($0.00015 / 1k)
    cached_input_usd_per_1k: 0.0000375, // $0.0375 per 1M tokens
    output_usd_per_1k: 0.0006,       // $0.60 per 1M tokens
    reasoning_usd_per_1k: 0.0006,    // Billed at output rate
  },
} as const;