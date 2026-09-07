
# Capstone Evidence Log: Usage Metering & Billing Engine

This document contains verification transcripts and proof outputs for all capstone requirements specified in Section 6.

---

## 1. Usage Metering & Idempotency

### Requirement:
> A billable action creates exactly one usage event, even under retries — deduplicated by idempotency key.

### Test Execution: Probe 1 (Idempotency & Deduplication)
**Command Executed**:
```bash
# Request 1 (Initial Call)
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: test-key-101" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_call"}'

# Request 2 (Duplicate Retry)
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: test-key-101" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_call"}'

```

### Transcript / Output Proof:

<img width="1375" height="581" alt="image" src="https://github.com/user-attachments/assets/d25404dd-d960-4055-801b-113136dfad63" />


### Database Record Verification:

<img width="1535" height="246" alt="image" src="https://github.com/user-attachments/assets/3ced9f79-188d-442e-91c7-cc71adfd37b5" />


---

## 2. Quotas & Boundary Enforcement

### Requirement:

> Usage is checked against the tenant's plan; requests over the limit are rejected with 429 / 402 status codes and clear messages.

### Test Execution: Probe 2 (Quota Boundary Check)

**Command Executed**:

```bash
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: test-key-overage" \
  -H "Content-Type: application/json" \
  -d '{"type": "ai_tokens", "input_tokens": 500000}'

```

### Transcript / Output Proof:

<img width="1396" height="283" alt="image" src="https://github.com/user-attachments/assets/8028d1b7-11df-4044-aa00-da8db5fe509a" />


---

## 3. Stripe Integration & Webhooks

### Requirement:

> Subscription checkout works end-to-end in Stripe test mode. Webhooks verify signatures, ignore duplicate events, and update tenant plan/status.

### Probe 3: Stripe Checkout Sync Proof

```text
[PASTE TRANSCRIPT / LOG SHOWING FREE -> PRO PLAN FLIP VIA WEBHOOK]

```

### Probe 4: Forged Webhook & Replay Proof

```text
[PASTE TRANSCRIPT SHOWING FORGED SIGNATURE GETS HTTP 400 AND REPLAY IS PROCESSED ONCE]

```

---

## 4. Cost Calculation

### Requirement:

> Monthly usage rolls up into a cost figure per tenant; AI token pricing handles cached input and reasoning tokens.

### Probe 5: Cost Rollup Proof (`GET /usage`)

```http
[PASTE TRANSCRIPT OF GET /usage MATCHING PINNED PRICING CONSTANTS]

```

```

---

### Terminal Commands to Generate Evidence for Probe 1 (`test-key-101`)

To populate Section 1 of your `EVIDENCE.md`, run these two terminal commands sequentially against your running Docker containers[cite: 2, 3]:

#### Request 1: Initial Call
```bash
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: test-key-101" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_call"}'

```

#### Request 2: Duplicate Retry

```bash
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: test-key-101" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_call"}'

```

#### Database Verification Command

Inspect your database container to verify that only a single row exists for `test-key-101`:

```bash
docker exec -it <db_container_name> psql -U postgres -d billing_db -c "SELECT id, tenant_id, event_type, quantity, idempotency_key, created_at FROM usage_events WHERE idempotency_key = 'test-key-101';"

```