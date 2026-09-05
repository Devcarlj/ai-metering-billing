# Design Document: Usage Metering & Billing Engine

## 1. Problem & Architecture Overview
This system meters billable API usage (API calls and AI tokens) per tenant, enforces monthly quotas, calculates charges using pinned money rules, and synchronizes tenant plans via Stripe test webhooks.

Architecture Layers:
Client / Caller -> HTTP Routes (Express/TS) -> Service Layer (Metering & Quotas) -> PostgreSQL Database

## 2. Database Schema

### `tenants`
- `id`: UUID (Primary Key)
- `name`: VARCHAR(255)
- `stripe_customer_id`: VARCHAR(255) (Unique, Nullable)
- `created_at`: TIMESTAMP

### `plans`
- `id`: VARCHAR(50) (Primary Key, e.g., 'free', 'pro')
- `name`: VARCHAR(255)
- `max_api_calls`: INT (Monthly quota)
- `max_ai_tokens`: INT (Monthly quota)

### `subscriptions`
- `id`: UUID (Primary Key)
- `tenant_id`: UUID (Foreign Key -> tenants.id)
- `plan_id`: VARCHAR(50) (Foreign Key -> plans.id)
- `stripe_subscription_id`: VARCHAR(255) (Unique, Nullable)
- `status`: VARCHAR(50) ('active', 'canceled', 'past_due')
- `current_period_start`: TIMESTAMP
- `current_period_end`: TIMESTAMP

### `usage_events`
- `id`: UUID (Primary Key)
- `tenant_id`: UUID (Foreign Key -> tenants.id)
- `event_type`: VARCHAR(50) ('api_call', 'ai_tokens')
- `quantity`: INT
- `idempotency_key`: VARCHAR(255) (Unique)
- `created_at`: TIMESTAMP

## 3. Plan Quotas Definition
| Plan | API Calls / Month | AI Tokens / Month |
| :--- | :--- | :--- |
| **Free** | 1,000 | 100,000 |
| **Pro** | 50,000 | 5,000,000 |

## 4. Metering API Contract & Idempotency Strategy

### Billable Endpoint: `POST /generate`
- **Request Headers**: `X-Tenant-ID`, `Idempotency-Key`
- **Request Body**:
  ```json
  {
    "type": "ai_tokens",
    "input_tokens": 100,
    "cached_input_tokens": 50,
    "output_tokens": 200,
    "reasoning_tokens": 50
  }