# BUILDLOG.md

This document tracks the usage of AI throughout the development of the Usage Metering & Billing Engine capstone, specifically detailing where the AI assisted, where it provided incorrect or incomplete solutions, and how the code was ultimately corrected and adapted.

## Phase 1 & 2: Database Persistence and Core Idempotency

* **Where AI helped:** The AI provided the foundational understanding of how Docker handles persistent data using named volumes. It clarified that simply restarting a Docker container does not wipe the database, which informed how I handled testing. It also helped explain the financial engineering necessity of idempotency keys, noting that they prevent double-charging during network retries and webhook replays.
* **Where AI was wrong / incomplete:** The AI initially suggested returning a standard parsed JSON object for the idempotency cache.
* **What I changed:** I updated `src/services/meterService.ts` to stringify the payload exactly once and store it as a raw `TEXT` field in PostgreSQL, rather than `JSONB`. This was necessary to guarantee byte-for-byte consistency (including exact JSON property ordering) when returning cached responses for duplicate requests.

## Phase 3: Stripe Checkout & Webhooks

* **Where AI helped:** The AI provided the initial boilerplate for the Stripe Node.js SDK and the Express middleware necessary to capture raw request buffers (`express.raw({ type: 'application/json' })`) for cryptographic signature verification. It also provided the exact `curl` commands needed to test forged webhook signatures.
* **Where AI was wrong:**
1. **Database Schema Constraints:** The AI's initial PostgreSQL query for upgrading a tenant used an `ON CONFLICT (tenant_id) DO UPDATE` clause. However, the AI forgot to include a `UNIQUE` constraint on the `tenant_id` column in `schema.sql`. PostgreSQL strictly requires a unique constraint for upserts, causing the webhook handler to crash.
2. **Missing Columns:** The upsert query attempted to set `updated_at = NOW()`, but the AI never included the `updated_at` column in the initial `subscriptions` table schema.
3. **Stripe CLI Generic Triggers:** The AI wrote webhook logic that strictly required a `client_reference_id` to identify the tenant. However, when instructing me to test with the generic `stripe trigger checkout.session.completed` command, the Stripe CLI omitted this ID (leaving it `null`), causing the database update to fail.
4. **Stripe CLI Commands:** When attempting to test replay protection (Probe 4), the AI repeatedly instructed me to run `stripe resend <event_id>`. This command does not exist in the Stripe CLI and threw an error.


* **What I changed:**
1. I manually updated `schema.sql` to add `UNIQUE(tenant_id)` and the `updated_at` column to the `subscriptions` table.
2. I added runtime database migration logic in `initDb.ts` using `ALTER TABLE` to ensure my existing Docker volume picked up the new constraints without needing to wipe the database.
3. I modified the webhook handler in `stripe.ts` to fall back to my seeded testing tenant ID (`11111111-1111-1111-1111-111111111111`) if `client_reference_id` was missing. I also learned to use the `--override` flag in the Stripe CLI.
4. I corrected the AI's CLI command to the actual valid command: `stripe events resend <event_id>`.



## Phase 4: Cost Calculation & Rollups

* **Where AI helped:** The AI correctly structured the `src/constants/pricing.ts` file to pin the exact USD costs for API calls, input tokens, cached input tokens, output tokens, and reasoning tokens based on the capstone specifications. It helped write the mathematical rollup logic in `costService.ts` to iterate through the `usage_events` table and separate the billing tiers correctly.
* **Where AI was wrong:** No major logical errors were introduced by the AI in this phase.
* **What I changed:** I integrated the cost service into the final `GET /usage` endpoint and validated the math against the expected outputs to generate the final `EVIDENCE.md` transcripts.