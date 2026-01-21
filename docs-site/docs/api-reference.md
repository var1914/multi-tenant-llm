# API Reference

Complete reference for TokenTrail's REST API.

## Base URL

```
https://api.tokentrailapp.com/v1
```

## Authentication

All API requests require authentication using your TokenTrail API key.

### Header Authentication

```bash
curl https://api.tokentrailapp.com/v1/customers \
  -H "Authorization: Bearer tt_live_abc123..."
```

### API Keys

Get your API keys from the dashboard: **Settings → API Keys**

- **Live keys** (`tt_live_...`) - Production use
- **Test keys** (`tt_test_...`) - Development/testing

## Rate Limits

| Plan | Requests/Minute | Requests/Hour |
|------|-----------------|---------------|
| Free | 60 | 1,000 |
| Pro | 600 | 10,000 |
| Enterprise | Custom | Custom |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1609459200
```

## Errors

TokenTrail uses standard HTTP response codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "Customer with external_id 'customer_123' already exists",
    "code": "duplicate_resource"
  }
}
```

## Endpoints

### Customers

#### List Customers

```http
GET /customers
```

**Parameters:**
- `limit` (optional) - Number of results (default: 100, max: 1000)
- `offset` (optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "cust_abc123",
      "external_id": "customer_abc",
      "name": "Acme Corporation",
      "email": "billing@acme.com",
      "budget_limit_usd": "100.00",
      "budget_alert_threshold": "80.00",
      "budget_block_on_limit": true,
      "created_at": "2024-01-01T00:00:00Z",
      "metadata": {
        "tier": "enterprise"
      }
    }
  ],
  "has_more": false,
  "total_count": 1
}
```

#### Create Customer

```http
POST /customers
```

**Request Body:**
```json
{
  "external_id": "customer_abc",
  "name": "Acme Corporation",
  "email": "billing@acme.com",
  "budget_limit_usd": 100.00,
  "budget_alert_threshold": 80,
  "budget_alert_enabled": true,
  "budget_block_on_limit": true,
  "metadata": {
    "tier": "enterprise",
    "plan": "pro"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "cust_abc123",
  "external_id": "customer_abc",
  ...
}
```

#### Get Customer

```http
GET /customers/:id
```

**Response:**
```json
{
  "id": "cust_abc123",
  "external_id": "customer_abc",
  "name": "Acme Corporation",
  ...
}
```

#### Update Customer

```http
PATCH /customers/:id
```

**Request Body:**
```json
{
  "name": "Acme Corp (Updated)",
  "budget_limit_usd": 200.00,
  "budget_block_on_limit": false
}
```

**Response:** `200 OK`

#### Delete Customer

```http
DELETE /customers/:id
```

**Response:** `204 No Content`

#### Get Customer Usage

```http
GET /customers/:id/usage
```

**Parameters:**
- `period` - Time period: `day`, `week`, `month`, `year`, or `custom`
- `start_date` - For custom period (ISO 8601)
- `end_date` - For custom period (ISO 8601)

**Response:**
```json
{
  "customer_id": "customer_abc",
  "customer_name": "Acme Corporation",
  "period": "month",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "total_requests": 1247,
  "total_tokens": 234567,
  "total_cost_usd": "85.23",
  "breakdown_by_model": [
    {
      "model": "gpt-4",
      "requests": 423,
      "tokens": 123456,
      "cost_usd": "42.12"
    }
  ],
  "daily_usage": [
    {
      "date": "2024-01-01",
      "requests": 45,
      "tokens": 8901,
      "cost_usd": "3.21"
    }
  ]
}
```

#### Get Customer Budget Status

```http
GET /customers/:id/budget-status
```

**Response:**
```json
{
  "customer_id": "customer_abc",
  "customer_name": "Acme Corporation",
  "budget_limit_usd": "100.00",
  "budget_block_on_limit": true,
  "current_spend_usd": "85.23",
  "percentage_used": 85.23,
  "is_over_budget": false,
  "is_near_threshold": true,
  "is_blocked": false
}
```

### Usage Events

#### List Usage Events

```http
GET /usage
```

**Parameters:**
- `customer_id` (optional) - Filter by customer
- `model` (optional) - Filter by model
- `start_date` (optional) - Filter start date
- `end_date` (optional) - Filter end date
- `limit` (optional) - Results per page (max 1000)
- `offset` (optional) - Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "evt_abc123",
      "customer_id": "customer_abc",
      "model": "gpt-4",
      "provider": "openai",
      "input_tokens": 123,
      "output_tokens": 456,
      "total_tokens": 579,
      "cost_usd": "0.0123",
      "routing_applied": true,
      "original_model": "gpt-4",
      "routed_model": "gpt-3.5-turbo",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "feature": "chat",
        "session_id": "sess_xyz"
      }
    }
  ],
  "has_more": true,
  "total_count": 12459
}
```

### Analytics

#### Get Analytics Summary

```http
GET /analytics/summary
```

**Parameters:**
- `period` - `day`, `week`, `month`, or `year`
- `start_date` (optional) - For custom range
- `end_date` (optional) - For custom range

**Response:**
```json
{
  "period": "month",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "total_requests": 12459,
  "total_tokens": 2847293,
  "total_cost_usd": "1234.56",
  "average_cost_per_request": "0.099",
  "breakdown_by_model": [...],
  "breakdown_by_customer": [...],
  "savings_from_routing": "523.12"
}
```

#### Get Analytics by Model

```http
GET /analytics/by-model
```

**Response:**
```json
{
  "data": [
    {
      "model": "gpt-4",
      "requests": 3425,
      "tokens": 890123,
      "cost_usd": "678.90",
      "percentage_of_total": 55
    },
    {
      "model": "gpt-3.5-turbo",
      "requests": 8234,
      "tokens": 1234567,
      "cost_usd": "345.67",
      "percentage_of_total": 28
    }
  ]
}
```

#### Get Analytics by Customer

```http
GET /analytics/by-customer
```

**Parameters:**
- `limit` (optional) - Top N customers (default: 10)
- `sort_by` - `requests`, `tokens`, or `cost` (default: `cost`)

**Response:**
```json
{
  "data": [
    {
      "customer_id": "customer_abc",
      "customer_name": "Acme Corp",
      "requests": 5234,
      "tokens": 1123456,
      "cost_usd": "567.89",
      "trend": "+12%"
    }
  ]
}
```

#### Export Analytics

```http
GET /analytics/export
```

**Parameters:**
- `format` - `csv` or `json`
- `period` - Time period
- `start_date`, `end_date` (optional)

**Response:** CSV or JSON file download

### Smart Routing

#### Get Routing Rules

```http
GET /routing/rules
```

**Response:**
```json
{
  "smart_routing_enabled": true,
  "rules": [
    {
      "source_model": "gpt-4",
      "complexity_max": 0.4,
      "target_model": "gpt-3.5-turbo",
      "enabled": true
    },
    {
      "source_model": "gpt-4",
      "complexity_min": 0.4,
      "complexity_max": 0.7,
      "target_model": "gpt-4-turbo",
      "enabled": true
    }
  ]
}
```

#### Update Routing Rules

```http
PATCH /routing/rules
```

**Request Body:**
```json
{
  "smart_routing_enabled": true,
  "rules": [
    {
      "source_model": "gpt-4",
      "complexity_max": 0.5,
      "target_model": "gpt-3.5-turbo"
    }
  ]
}
```

**Response:** `200 OK`

#### Test Routing

```http
POST /routing/test
```

**Request Body:**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "What is 2+2?"}
  ]
}
```

**Response:**
```json
{
  "original_model": "gpt-4",
  "routed_model": "gpt-3.5-turbo",
  "would_route": true,
  "complexity_score": 0.12,
  "confidence": 0.95,
  "estimated_savings_usd": "0.0231",
  "reason": "Simple arithmetic question"
}
```

#### Get Routing Analytics

```http
GET /analytics/routing
```

**Response:**
```json
{
  "period": "2024-01",
  "total_requests": 12459,
  "routed_requests": 8234,
  "routing_rate": 0.66,
  "total_savings_usd": "523.12",
  "breakdown": [
    {
      "source": "gpt-4",
      "target": "gpt-3.5-turbo",
      "count": 6523,
      "savings_usd": "421.34"
    }
  ]
}
```

### API Keys

#### List API Keys

```http
GET /api-keys
```

**Response:**
```json
{
  "data": [
    {
      "id": "key_abc123",
      "key_prefix": "tt_live_abc",
      "name": "Production API Key",
      "environment": "live",
      "is_active": true,
      "last_used_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create API Key

```http
POST /api-keys
```

**Request Body:**
```json
{
  "name": "Production API Key",
  "environment": "live"
}
```

**Response:** `201 Created`
```json
{
  "id": "key_abc123",
  "key": "tt_live_abc123def456...",
  "key_prefix": "tt_live_abc",
  "name": "Production API Key",
  "environment": "live",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**⚠️ Important:** The full `key` is only returned once. Store it securely.

#### Revoke API Key

```http
DELETE /api-keys/:id
```

**Response:** `204 No Content`

## Webhooks

### Configure Webhooks

```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/tokentrail",
  "events": [
    "budget.threshold_reached",
    "budget.limit_exceeded",
    "usage.anomaly_detected"
  ],
  "secret": "your-webhook-secret"
}
```

### Webhook Events

**Budget Threshold Reached:**
```json
{
  "type": "budget.threshold_reached",
  "customer_id": "customer_abc",
  "customer_name": "Acme Corp",
  "budget_limit_usd": "100.00",
  "current_spend_usd": "85.23",
  "percentage_used": 85.23,
  "threshold": 80,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Budget Limit Exceeded:**
```json
{
  "type": "budget.limit_exceeded",
  "customer_id": "customer_abc",
  "budget_limit_usd": "100.00",
  "current_spend_usd": "102.45",
  "blocked": true,
  "timestamp": "2024-01-15T14:22:00Z"
}
```

## SDKs

### Official SDKs

- **Node.js**: `npm install @tokentrail/node`
- **Python**: `pip install tokentrail`
- **Go**: `go get github.com/tokentrailapp/tokentrail-go`

### Example Usage (Node.js)

```javascript
import { TokenTrail } from '@tokentrail/node'

const tokentrail = new TokenTrail('tt_live_...')

// Create customer
const customer = await tokentrail.customers.create({
  external_id: 'customer_abc',
  name: 'Acme Corp',
  budget_limit_usd: 100.00
})

// Get usage
const usage = await tokentrail.customers.getUsage('customer_abc', {
  period: 'month'
})

console.log(usage.total_cost_usd)
```

## Pagination

All list endpoints support cursor-based pagination:

```http
GET /customers?limit=100&offset=0
```

**Response includes:**
```json
{
  "data": [...],
  "has_more": true,
  "total_count": 523
}
```

**Next page:**
```http
GET /customers?limit=100&offset=100
```

## Versioning

API version is specified in the URL:

```
https://api.tokentrailapp.com/v1/...
```

Current version: **v1**

## Support

- 📧 API Support: tokentrailapp@gmail.com
- 📚 Full Docs: [docs.tokentrailapp.com](https://docs.tokentrailapp.com)
- 💬 Discord: [Join community](https://discord.gg/tokentrail)
