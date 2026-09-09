
# Usage Metering & Billing Engine
A production-grade API metering and billing engine built with Node.js, Express, PostgreSQL, and Docker. This system tracks API usage and complex AI token metrics, enforces exact plan quotas, and synchronizes subscription tiers using idempotent Stripe webhooks.

It is designed around strict financial engineering principles: every endpoint handles network retries gracefully, prevents double-counting, and rejects unauthorized or duplicated billing events safely.

## Hero Overview
<img width="1620" height="900" alt="billing-api" src="https://github.com/user-attachments/assets/6f0122e7-2912-4b0a-9403-f07a2f988c76" />

---

## 🏗️ System Architecture

The application is structured into three primary paths: a metering path, a read/rollup path, and a payment-sync path.

<img width="1920" height="900" alt="billing-capstone-dataflow" src="https://github.com/user-attachments/assets/06e73826-9957-4c7f-84c8-e05f894ab37a" />




---

## 🚀 Quick Start (Run & Seed)

The system is fully containerized. A clean clone will automatically initialize the database, run migrations, and seed test data.

### 1. Environment Setup

Copy the placeholder variables to your local environment file:

```bash
cp .env.example .env

```

*(Add your `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the `.env` file to test local webhooks).*

### 2. Boot the Stack

Start the API and PostgreSQL database via Docker Compose:

```bash
docker compose up --build

```

*The database automatically provisions the schema and seeds a test tenant (`11111111-1111-1111-1111-111111111111`) on the `free` plan.*

### 3. Verify the Seeded System

Test the metering endpoint to confirm the database and API are actively tracking usage:

```bash
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: initial-test-key-001" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_call"}'

```

### 4. (Optional) Stripe Webhook Forwarding

To test local subscription upgrades, run the Stripe CLI forwarder in a separate terminal:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe

```

---

## 🔎 The Proof: `EVIDENCE.md`

Billing systems look simple from the outside, but edge-case bugs cost real money. Claims of reliability mean nothing without proof.

Please review the **[`EVIDENCE.md`](./EVIDENCE.md)** audit log included in this repository. It contains exact terminal transcripts, database outputs, and HTTP response proofs demonstrating the structural integrity of the system:

* **Exactly-Once Execution:** Network retries with the same idempotency key return byte-for-byte identical responses without double-counting usage.
* **Hard Quota Boundaries:** Requests that cross a tenant's plan limits are cleanly rejected with HTTP `429 Too Many Requests`.
* **Webhook Replay Protection:** Replayed Stripe events are caught and ignored at the database layer, preventing duplicate plan upgrades.
* **Forged Signature Defense:** Webhooks with invalid cryptographic signatures are safely rejected instantly with HTTP `400 Bad Request`.
* **Complex Cost Math:** AI token rollups explicitly calculate and separate fresh input, cached input, output, and reasoning tokens according to strict USD pricing constants.

---

## ⚠️ Honest Limitations

To maintain a focused, resilient core, this system intentionally scopes out several complex features:

* **No Real Money:** The integration is strictly built for Stripe Test Mode.


* **No Proration or Overage Billing:** Upgrades simply flip the database state from `free` to `pro`. The system does not calculate mid-month proration, generate invoices, or execute variable overage billing.


* **Simulated AI Generation:** The `POST /generate` endpoint acts as a dummy billable gateway. It records the requested token metrics and checks quotas, but it does not proxy requests to actual LLMs (like OpenAI or Anthropic).