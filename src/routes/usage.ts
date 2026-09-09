import { Router, Request, Response } from 'express';
import { CostService } from '../services/costService.js';

export const createUsageRouter = (costService: CostService) => {
  const router = Router();

  router.get('/usage', async (req: Request, res: Response) => {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing required X-Tenant-ID header.' });
    }

    const summary = await costService.getTenantUsageSummary(tenantId);

    if (!summary) {
      return res.status(404).json({ error: 'Tenant or active subscription not found.' });
    }

    return res.status(200).json(summary);
  });

  return router;
};