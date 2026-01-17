export interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  tenant_id: string
}

export interface Tenant {
  id: string
  company_name: string
  slug: string
  subscription_status: string
  subscription_plan: string
  created_at: string
}

export interface Customer {
  id: string
  external_id: string
  name: string | null
  email: string | null
  metadata: Record<string, unknown>
  budget_limit_usd: string | null
  budget_alert_threshold: string | null
  budget_alert_enabled: boolean | null
  budget_block_on_limit: boolean | null
  workflow_budget_usd: string | null
  workflow_budget_action: string | null
  created_at: string
}

export interface ApiKey {
  id: string
  key_prefix: string
  key?: string  // Only present when created
  name: string | null
  environment: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export interface UsageEvent {
  success: boolean
  event_id: string
  customer_id: string
  quantity: number
  cost_usd: number | null
  timestamp: string
}

export interface UsageSummary {
  customer_id: string
  total_quantity: number
  total_cost_usd: number
  event_count: number
  start_date: string
  end_date: string
}

export interface AuthResponse {
  user: User
  access_token: string
  token_type: string
  expires_in: number
}
