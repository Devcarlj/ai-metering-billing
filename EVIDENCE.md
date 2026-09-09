
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

---

### Test Execution: Probe 3 (Stripe Checkout Plan Upgrade Proof)

**Command Executed (Stripe CLI Trigger with Tenant ID Override)**:
```bash
stripe trigger checkout.session.completed \
  --override checkout_session:client_reference_id=11111111-1111-1111-1111-111111111111

```

### Transcript / Output Proof:

<img width="1412" height="117" alt="Screenshot 2026-09-09 011248" src="https://github.com/user-attachments/assets/022bccad-971e-4338-b7a1-afcc012bc843" />

<br>&nbsp;
**Command Executed (Post-Upgrade Quota Verification)**:

```bash
curl -i -X POST http://localhost:3000/generate \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: post-upgrade-key-500k" \
  -H "Content-Type: application/json" \
  -d '{"type": "ai_tokens", "input_tokens": 500000}'

```

### Transcript / Output Proof:

<img width="1387" height="378" alt="image" src="https://github.com/user-attachments/assets/bc7915cc-48db-4252-9347-af0cab7ac12c" />

<br>&nbsp;
**Database Record Verification**:

<img width="1527" height="246" alt="image" src="https://github.com/user-attachments/assets/861a31a3-df34-434d-9965-9f82f31e9080" />



### Probe 4: Webhook Signature Verification & Replay Protection

#### Part A: Forged Webhook Signature Test
**Objective**: Prove that webhooks with invalid cryptographic signatures are safely rejected with `HTTP 400 Bad Request` without modifying system or database state.

**Command Executed**:
```bash
curl -i -X POST http://localhost:3000/webhooks/stripe \
  -H "Stripe-Signature: t=123456,v1=invalid_forged_signature_hash" \
  -H "Content-Type: application/json" \
  -d '{"id": "evt_forged_999", "type": "checkout.session.completed"}'

```

### Transcript / Output Proof:

<img width="1417" height="495" alt="Screenshot 2026-09-09 014759" src="https://github.com/user-attachments/assets/03a0f1e2-7711-4f6a-ae00-3cd2696484a0" />


---

#### Part B: Webhook Replay Deduplication Test

**Objective**: Replay an identical valid Stripe webhook event (`evt_...`) using the Stripe CLI to prove the backend executes business logic once and cleanly ignores duplicate replays.

**Commands Executed**:

```bash
# 1. Trigger Initial Event to obtain a valid Event ID
stripe trigger checkout.session.completed \
  --override checkout_session:client_reference_id=11111111-1111-1111-1111-111111111111

# 2. Resend the exact same Event ID to test replay protection
stripe resend evt_3UDTAX3mOiEZhsjr0H22ll6u

```

### Transcript / Output Proof:
<img width="1383" height="57" alt="image" src="https://github.com/user-attachments/assets/46af93b9-7d72-4bdc-a846-c083e032932b" />
<br>&nbsp;
<img width="1167" height="61" alt="image" src="https://github.com/user-attachments/assets/a3da6f59-f4cc-438c-ae79-a07e7f3db1ac" />


**Database Deduplication Record (psql verification)**:

<img width="1535" height="252" alt="image" src="https://github.com/user-attachments/assets/fd0f6795-2fb9-40ad-94f6-b801d52eb052" />

---

## 4. Cost Calculation & Final Hardening

### Requirement:
> Monthly usage rolls up into a cost figure per tenant; AI token pricing handles cached input and reasoning tokens according to pinned money rules.

---

### Probe 5: Cost Rollup Verification (`GET /usage`)

**Objective**: Verify that the `/usage` endpoint correctly aggregates API calls and AI tokens across all categories (input, cached input, output, and reasoning) within the active billing period, applying the exact pinned pricing constants to compute individual and total USD costs[cite: 1].

**Pricing Constants Used (`src/constants/pricing.ts`)**:
* **API Calls**: `$0.001` per call[cite: 1]
* **Fresh Input Tokens**: `$0.00015` per 1k tokens (`$0.15` per 1M)[cite: 1]
* **Cached Input Tokens**: `$0.0000375` per 1k tokens (`$0.0375` per 1M)[cite: 1]
* **Output Tokens**: `$0.0006` per 1k tokens (`$0.60` per 1M)[cite: 1]
* **Reasoning Tokens**: Billed at output rate (`$0.0006` per 1k tokens)[cite: 1]

**Command Executed**:
```bash
curl -i -X GET http://localhost:3000/usage \
  -H "X-Tenant-ID: 11111111-1111-1111-1111-111111111111"

```

**Transcript Proof**:
<br>
<img width="1410" height="360" alt="image" src="https://github.com/user-attachments/assets/d878b280-086a-49e6-839b-5f3fcf7b24c5" />



**Math Breakdown & Proof of Verification**:

1. **API Calls**: $12 \text{ calls} \times \$0.001 = \$0.012000$
2. **Fresh Input Tokens**: $(100,000 / 1000) \times \$0.00015 = \$0.015000$
3. **Cached Input Tokens**: $(200,000 / 1000) \times \$0.0000375 = \$0.007500$
4. **Output Tokens**: $(100,000 / 1000) \times \$0.0006 = \$0.060000$
5. **Reasoning Tokens**: $(110,000 / 1000) \times \$0.0006 = \$0.066000$
6. **Total AI Tokens Cost**: $\$0.015000 + \$0.007500 + \$0.060000 + \$0.066000 = \$0.148500$
7. **Total Cost USD**: $\$0.012000 + \$0.148500 = \mathbf{\$0.160500}$
