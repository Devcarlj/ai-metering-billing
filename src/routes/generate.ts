import { Router, Request, Response } from 'express';
import { MeterService } from '../services/meterService.js';


export const createGenerateRouter = (meterService: MeterService) => {
  const router = Router();

  router.post('/generate', async (req: Request, res: Response) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!tenantId || !idempotencyKey) {
      return res.status(400).json({ error: 'Missing required X-Tenant-ID or Idempotency-Key headers.' });
    }

    const { type, input_tokens = 0, cached_input_tokens = 0, output_tokens = 0, reasoning_tokens = 0 } = req.body;

    const totalTokens = input_tokens + cached_input_tokens + output_tokens + reasoning_tokens;
    const quantity = type === 'api_call' ? 1 : totalTokens;
    const eventType = type === 'api_call' ? 'api_call' : 'ai_tokens';

    const payloadObj = {
      status: 'success',
      metered_quantity: quantity,
      type: eventType,
      data: 'Generated content response stub'
    };

    const result = await meterService.recordUsage(tenantId, eventType, quantity, idempotencyKey, payloadObj);

    if (result.error) {
      return res.status(result.error.status ?? 500).json({
        error: result.error.reason,
        message: result.error.message
      });
    }

    // Transmit exact raw string back with application/json header
    return res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .send(result.rawResponse);
  });

  return router;
};
