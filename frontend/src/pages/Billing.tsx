import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

interface PricingPlan {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly_usd: string
  price_yearly_usd: string | null
  included_tokens: number
  overage_price_per_1k_tokens: string
  max_customers: number | null
  max_api_keys: number | null
  features: string[] | null
}

interface Subscription {
  tenant_id: string
  current_plan: PricingPlan | null
  subscription_status: string | null
  subscription_period_end: string | null
  stripe_subscription_id: string | null
}

interface CurrentUsage {
  period_start: string
  period_end: string
  tokens_used: number
  tokens_included: number
  tokens_remaining: number
  overage_tokens: number
  estimated_overage_cost: string
  plan_name: string
  plan_base_cost: string
}

interface BillingConfig {
  stripe_publishable_key: string
  stripe_configured: boolean
  demo_mode: boolean
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`
  }
  return num.toString()
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Billing() {
  const [searchParams] = useSearchParams()
  const [showSuccess, setShowSuccess] = useState(false)
  const queryClient = useQueryClient()

  // Check for success/cancel params from Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] })
    }
  }, [searchParams, queryClient])

  // Fetch billing config
  const { data: config } = useQuery<BillingConfig>({
    queryKey: ['billing-config'],
    queryFn: async () => {
      const response = await apiClient.get('/billing/config')
      return response.data
    },
  })

  // Fetch pricing plans
  const { data: plans, isLoading: plansLoading } = useQuery<PricingPlan[]>({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const response = await apiClient.get('/billing/plans')
      return response.data
    },
  })

  // Fetch current subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await apiClient.get('/billing/subscription')
      return response.data
    },
  })

  // Fetch current usage
  const { data: usage } = useQuery<CurrentUsage>({
    queryKey: ['billing-usage'],
    queryFn: async () => {
      const response = await apiClient.get('/billing/usage')
      return response.data
    },
  })

  const isDemoMode = config?.demo_mode ?? true

  // Subscribe mutation - uses demo endpoint if Stripe not configured
  const subscribeMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      const endpoint = isDemoMode ? '/billing/demo-subscribe' : '/billing/checkout'
      const response = await apiClient.post(endpoint, {
        plan_slug: planSlug,
        billing_interval: 'monthly',
      })
      return response.data
    },
    onSuccess: (data) => {
      if (isDemoMode) {
        // Demo mode - just show success and refresh
        setShowSuccess(true)
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        queryClient.invalidateQueries({ queryKey: ['billing-usage'] })
      } else {
        // Stripe mode - redirect to Stripe Checkout
        window.location.href = data.checkout_url
      }
    },
  })

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isDemoMode ? '/billing/demo-cancel' : '/billing/cancel'
      const response = await apiClient.post(endpoint, {})
      return response.data
    },
    onSuccess: () => {
      setShowSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })

  // Portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/billing/portal')
      return response.data
    },
    onSuccess: (data) => {
      window.location.href = data.portal_url
    },
  })

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const isStripeConfigured = config?.stripe_configured ?? false

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription plan and billing settings
        </p>
      </div>

      {/* Success message */}
      {showSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Subscription updated successfully!
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setShowSuccess(false)}
                className="text-green-500 hover:text-green-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo mode info banner */}
      {isDemoMode && (
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Demo Mode Active</h3>
              <p className="mt-1 text-sm text-blue-700">
                Stripe is not configured. You can test the billing flow without real payments.
                Subscriptions will be activated instantly for testing purposes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      {subscription && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="text-lg font-medium text-gray-900">
                {subscription.current_plan?.name || 'No plan selected'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                subscription.subscription_status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : subscription.subscription_status === 'trialing'
                  ? 'bg-blue-100 text-blue-800'
                  : subscription.subscription_status === 'past_due'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {subscription.subscription_status || 'None'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Next billing date</p>
              <p className="text-lg font-medium text-gray-900">
                {subscription.subscription_period_end
                  ? formatDate(subscription.subscription_period_end)
                  : 'N/A'}
              </p>
            </div>
          </div>

          {subscription.stripe_subscription_id && (
            <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
              {isStripeConfigured && (
                <button
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
                </button>
              )}
              {isDemoMode && subscription.subscription_status === 'active' && (
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription (Demo)'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current Usage Card */}
      {usage && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Period Usage</h2>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {formatNumber(usage.tokens_used)} / {formatNumber(usage.tokens_included)} tokens
              </span>
              <span>
                {((usage.tokens_used / usage.tokens_included) * 100).toFixed(1)}% used
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  usage.tokens_used > usage.tokens_included
                    ? 'bg-red-600'
                    : usage.tokens_used > usage.tokens_included * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${Math.min(100, (usage.tokens_used / usage.tokens_included) * 100)}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Period</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(usage.period_start)} - {formatDate(usage.period_end)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tokens Remaining</p>
              <p className="text-lg font-medium text-gray-900">{formatNumber(usage.tokens_remaining)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overage Tokens</p>
              <p className="text-lg font-medium text-red-600">{formatNumber(usage.overage_tokens)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Est. Overage Cost</p>
              <p className="text-lg font-medium text-red-600">
                {formatCurrency(usage.estimated_overage_cost)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans?.map((plan) => {
            const isCurrentPlan = subscription?.current_plan?.id === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow p-6 ${
                  isCurrentPlan ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                {isCurrentPlan && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mb-3">
                    Current Plan
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.price_monthly_usd)}
                  </span>
                  <span className="text-gray-500">/month</span>
                </div>

                <ul className="mt-6 space-y-3">
                  <li className="flex items-center text-sm text-gray-600">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {formatNumber(plan.included_tokens)} tokens included
                  </li>
                  <li className="flex items-center text-sm text-gray-600">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    ${parseFloat(plan.overage_price_per_1k_tokens).toFixed(4)}/1K overage tokens
                  </li>
                  <li className="flex items-center text-sm text-gray-600">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.max_customers ? `Up to ${plan.max_customers} customers` : 'Unlimited customers'}
                  </li>
                  <li className="flex items-center text-sm text-gray-600">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.max_api_keys ? `Up to ${plan.max_api_keys} API keys` : 'Unlimited API keys'}
                  </li>
                </ul>

                {plan.features && plan.features.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Features</p>
                    <ul className="space-y-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-xs text-gray-600">
                          {feature.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6">
                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => subscribeMutation.mutate(plan.slug)}
                      disabled={subscribeMutation.isPending}
                      className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {subscribeMutation.isPending ? 'Loading...' : (isDemoMode ? 'Try Plan (Demo)' : 'Select Plan')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
