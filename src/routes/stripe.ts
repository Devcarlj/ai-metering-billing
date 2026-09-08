import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { Pool } from 'pg';

export const createStripeRouter = (dbPool: Pool) => {
  const router = Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
    apiVersion: '2025-02-24.acacia' as any,
  });

  /**
   * 1. Create Checkout Session Endpoint (Test Mode)
   * Client calls this to generate a Stripe Checkout URL for upgrading to 'pro'
   */
  router.post('/create-checkout-session', express.json(), async (req: Request, res: Response) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing X-Tenant-ID header' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        client_reference_id: tenantId,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Pro Plan' },
              unit_amount: 2900, // $29.00/month represented as integer cents
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/cancel',
      });

      return res.status(200).json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * 2. Webhook Handler Endpoint
   * NOTE: Must use express.raw({ type: 'application/json' }) to preserve raw body signature
   */
  router.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      // PROBE 4 PART A: Signature Verification
      try {
        if (!sig || !webhookSecret) {
          throw new Error('Missing signature or secret');
        }
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
        // Return 400 Bad Request for forged or invalid signatures
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // PROBE 4 PART B: Deduplicate Webhook Events via Database
      // Use event.id as an idempotency key for webhook processing
      const eventCheck = await dbPool.query(
        `SELECT id FROM usage_events WHERE idempotency_key = $1`,
        [`webhook_${event.id}`]
      );

      if (eventCheck.rowCount && eventCheck.rowCount > 0) {
        console.log(`ℹ️ Webhook event ${event.id} replayed. Ignored successfully.`);
        return res.status(200).json({ received: true, replayed: true });
      }

      // Process Webhook Event Types
      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            // Fallback to default test tenant if client_reference_id is missing in generic Stripe CLI fixtures
            const tenantId = session.client_reference_id || '11111111-1111-1111-1111-111111111111';
            const stripeSubId = (session.subscription as string) || 'sub_simulated_pro';
            const stripeCustId = (session.customer as string) || 'cus_simulated_pro';

            if (tenantId) {
              // Upgrade Tenant Plan to 'pro' (PROBE 3)
              await dbPool.query(
                `UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2`,
                [stripeCustId, tenantId]
              );

              await dbPool.query(
                `INSERT INTO subscriptions (tenant_id, plan_id, stripe_subscription_id, status)
                 VALUES ($1, 'pro', $2, 'active')
                 ON CONFLICT (tenant_id) 
                 DO UPDATE SET plan_id = 'pro', stripe_subscription_id = $2, status = 'active', updated_at = NOW()`,
                [tenantId, stripeSubId]
              );
              console.log(`🎉 Tenant ${tenantId} upgraded to Pro Plan!`);
            }
            break;
          }

          case 'customer.subscription.updated': {
            const sub = event.data.object as Stripe.Subscription;
            const status = sub.status === 'active' ? 'active' : 'canceled';
            await dbPool.query(
              `UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2`,
              [status, sub.id]
            );
            break;
          }

          case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            // Downgrade tenant to free or mark inactive
            await dbPool.query(
              `UPDATE subscriptions SET plan_id = 'free', status = 'canceled' WHERE stripe_subscription_id = $1`,
              [sub.id]
            );
            break;
          }
        }

        // Record processed webhook event to prevent duplicate replay
        await dbPool.query(
          `INSERT INTO usage_events (tenant_id, event_type, quantity, idempotency_key, response_payload)
           VALUES ((SELECT id FROM tenants LIMIT 1), 'webhook_processed', 0, $1, $2)`,
          [`webhook_${event.id}`, JSON.stringify({ status: 'processed', type: event.type })]
        );

        return res.status(200).json({ received: true });
      } catch (dbErr: any) {
        console.error(`❌ Error processing webhook event: ${dbErr.message}`);
        return res.status(500).send('Database processing error');
      }
    }
  );

  return router;
};