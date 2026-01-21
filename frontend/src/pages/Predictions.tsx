import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import clsx from 'clsx'

interface PredictionSettings {
  prediction_alerts_enabled: boolean
  total_customers: number
  customers_with_budget: number
}

interface Forecast {
  customer_id: string
  customer_name: string | null
  current_spend: number
  budget_limit: number | null
  forecasted_spend_eom: number
  forecasted_spend_7d: number
  forecasted_spend_30d: number
  daily_average: number
  daily_trend: number
  days_until_budget_exceeded: number | null
  budget_utilization_percent: number
  confidence_score: number
  risk_level: string
  prediction_factors: string[]
}

interface Alert {
  id: string
  customer_id: string
  customer_external_id: string
  customer_name: string | null
  alert_type: string
  current_spend: number
  budget_limit: number
  utilization_percent: number
  forecasted_exceed_date: string | null
  message: string
  recommendations: string[]
  status: string
  created_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

interface PredictionSummary {
  total_customers: number
  customers_with_budget: number
  risk_distribution: Record<string, number>
  at_risk_count: number
  total_current_spend: number
  total_forecasted_30d: number
  average_confidence: number
  high_risk_customers: {
    customer_id: string
    customer_name: string | null
    risk_level: string
    utilization: number
    days_until_exceeded: number | null
  }[]
}

interface AlertStats {
  by_status: Record<string, number>
  active_by_type: Record<string, number>
  total_active: number
  total_all_time: number
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
}

const ALERT_COLORS: Record<string, { bg: string; text: string }> = {
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  critical: { bg: 'bg-orange-100', text: 'text-orange-800' },
  exceeded: { bg: 'bg-red-100', text: 'text-red-800' },
}

export default function Predictions() {
  const queryClient = useQueryClient()
  const [selectedTab, setSelectedTab] = useState<'overview' | 'forecasts' | 'alerts'>('overview')
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('')

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery<PredictionSettings>({
    queryKey: ['prediction-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/predictions/settings')
      return response.data
    },
  })

  // Fetch summary
  const { data: summary } = useQuery<PredictionSummary>({
    queryKey: ['prediction-summary'],
    queryFn: async () => {
      const response = await apiClient.get('/predictions/summary')
      return response.data
    },
  })

  // Fetch forecasts
  const { data: forecasts } = useQuery<Forecast[]>({
    queryKey: ['forecasts', riskFilter],
    queryFn: async () => {
      const params = riskFilter ? `?risk_filter=${riskFilter}` : ''
      const response = await apiClient.get(`/predictions/forecasts${params}`)
      return response.data
    },
    enabled: selectedTab === 'forecasts' || selectedTab === 'overview',
  })

  // Fetch alerts
  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ['prediction-alerts', alertStatusFilter],
    queryFn: async () => {
      const params = alertStatusFilter ? `?status=${alertStatusFilter}` : ''
      const response = await apiClient.get(`/predictions/alerts${params}`)
      return response.data
    },
    enabled: selectedTab === 'alerts' || selectedTab === 'overview',
  })

  // Fetch alert stats
  const { data: alertStats } = useQuery<AlertStats>({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/predictions/alerts/stats')
      return response.data
    },
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<PredictionSettings>) => {
      const response = await apiClient.put('/predictions/settings', newSettings)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-settings'] })
    },
  })

  // Generate alerts mutation
  const generateAlertsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/predictions/alerts/generate')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] })
    },
  })

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.put(`/predictions/alerts/${alertId}/acknowledge`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] })
    },
  })

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.put(`/predictions/alerts/${alertId}/resolve`, {})
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] })
    },
  })

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Predictive Budget Alerts</h1>
          <p className="text-gray-600">
            Forecast customer spending and get alerts before budgets are exceeded
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.prediction_alerts_enabled ?? true}
            onChange={(e) => updateSettingsMutation.mutate({ prediction_alerts_enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          <span className="ml-3 text-sm font-medium text-gray-900">
            {settings?.prediction_alerts_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'forecasts', 'alerts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm capitalize',
                selectedTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab}
              {tab === 'alerts' && alertStats?.total_active ? (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {alertStats.total_active}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-sm text-gray-500">Total Customers</div>
              <div className="text-2xl font-bold">{summary.total_customers}</div>
              <div className="text-xs text-gray-400">{summary.customers_with_budget} with budgets</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">At Risk</div>
              <div className="text-2xl font-bold text-orange-600">{summary.at_risk_count}</div>
              <div className="text-xs text-gray-400">Customers needing attention</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">Current Spend</div>
              <div className="text-2xl font-bold">${summary.total_current_spend.toFixed(2)}</div>
              <div className="text-xs text-gray-400">This month</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">30-Day Forecast</div>
              <div className="text-2xl font-bold text-indigo-600">${summary.total_forecasted_30d.toFixed(2)}</div>
              <div className="text-xs text-gray-400">
                Confidence: {(summary.average_confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Risk Distribution</h2>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(summary.risk_distribution).map(([level, count]) => (
                <div
                  key={level}
                  className={clsx(
                    'p-4 rounded-lg border',
                    RISK_COLORS[level]?.bg,
                    RISK_COLORS[level]?.border
                  )}
                >
                  <div className={clsx('text-2xl font-bold', RISK_COLORS[level]?.text)}>{count}</div>
                  <div className="text-sm capitalize">{level} Risk</div>
                </div>
              ))}
            </div>
          </div>

          {/* High Risk Customers */}
          {summary.high_risk_customers.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">High Risk Customers</h2>
              <div className="space-y-3">
                {summary.high_risk_customers.map((customer) => (
                  <div
                    key={customer.customer_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{customer.customer_name || customer.customer_id}</div>
                      <div className="text-sm text-gray-500">
                        {customer.utilization.toFixed(0)}% budget used
                        {customer.days_until_exceeded !== null && (
                          <span className="ml-2 text-red-600">
                            Exceeds in {customer.days_until_exceeded} days
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={clsx(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        RISK_COLORS[customer.risk_level]?.bg,
                        RISK_COLORS[customer.risk_level]?.text
                      )}
                    >
                      {customer.risk_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Alerts Summary */}
          {alertStats && alertStats.total_active > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Active Alerts</h2>
                <button
                  onClick={() => setSelectedTab('alerts')}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  View All
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(alertStats.active_by_type).map(([type, count]) => (
                  <div
                    key={type}
                    className={clsx(
                      'p-4 rounded-lg',
                      ALERT_COLORS[type]?.bg
                    )}
                  >
                    <div className={clsx('text-2xl font-bold', ALERT_COLORS[type]?.text)}>{count}</div>
                    <div className="text-sm capitalize">{type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forecasts Tab */}
      {selectedTab === 'forecasts' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Risk Levels</option>
              <option value="at_risk">At Risk (Medium+)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Forecasts Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Current Spend
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Budget
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Utilization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      30-Day Forecast
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Daily Trend
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Days to Exceed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {forecasts?.map((forecast) => (
                    <tr key={forecast.customer_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium">{forecast.customer_name || forecast.customer_id}</div>
                        <div className="text-xs text-gray-500">{forecast.customer_id}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">${forecast.current_spend.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm">
                        {forecast.budget_limit ? `$${forecast.budget_limit.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-24">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                forecast.budget_utilization_percent >= 100
                                  ? 'bg-red-500'
                                  : forecast.budget_utilization_percent >= 80
                                  ? 'bg-orange-500'
                                  : 'bg-green-500'
                              )}
                              style={{ width: `${Math.min(100, forecast.budget_utilization_percent)}%` }}
                            />
                          </div>
                          <span className="text-sm">{forecast.budget_utilization_percent.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">${forecast.forecasted_spend_30d.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={clsx(
                            'text-sm font-medium',
                            forecast.daily_trend > 0 ? 'text-red-600' : forecast.daily_trend < 0 ? 'text-green-600' : ''
                          )}
                        >
                          {forecast.daily_trend > 0 ? '+' : ''}
                          ${forecast.daily_trend.toFixed(4)}/day
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {forecast.days_until_budget_exceeded !== null ? (
                          <span className={clsx(
                            'font-medium',
                            forecast.days_until_budget_exceeded <= 7 ? 'text-red-600' : ''
                          )}>
                            {forecast.days_until_budget_exceeded === 0 ? 'Exceeded!' : `${forecast.days_until_budget_exceeded} days`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            RISK_COLORS[forecast.risk_level]?.bg,
                            RISK_COLORS[forecast.risk_level]?.text
                          )}
                        >
                          {forecast.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!forecasts || forecasts.length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No forecasts available. Add customers with budgets to see predictions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {selectedTab === 'alerts' && (
        <div className="space-y-6">
          {/* Actions & Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <button
              onClick={() => generateAlertsMutation.mutate()}
              disabled={generateAlertsMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {generateAlertsMutation.isPending ? 'Generating...' : 'Generate New Alerts'}
            </button>
          </div>

          {/* Alert Stats */}
          {alertStats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="text-sm text-gray-500">Active</div>
                <div className="text-2xl font-bold text-red-600">{alertStats.by_status.active || 0}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">Acknowledged</div>
                <div className="text-2xl font-bold text-yellow-600">{alertStats.by_status.acknowledged || 0}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">Resolved</div>
                <div className="text-2xl font-bold text-green-600">{alertStats.by_status.resolved || 0}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">Total All Time</div>
                <div className="text-2xl font-bold">{alertStats.total_all_time}</div>
              </div>
            </div>
          )}

          {/* Alerts List */}
          <div className="space-y-4">
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className={clsx(
                  'card p-6 border-l-4',
                  alert.alert_type === 'exceeded'
                    ? 'border-l-red-500'
                    : alert.alert_type === 'critical'
                    ? 'border-l-orange-500'
                    : 'border-l-yellow-500'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium uppercase',
                          ALERT_COLORS[alert.alert_type]?.bg,
                          ALERT_COLORS[alert.alert_type]?.text
                        )}
                      >
                        {alert.alert_type}
                      </span>
                      <span
                        className={clsx(
                          'px-2 py-1 rounded text-xs',
                          alert.status === 'active'
                            ? 'bg-red-100 text-red-700'
                            : alert.status === 'acknowledged'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        )}
                      >
                        {alert.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold">
                      {alert.customer_name || alert.customer_external_id}
                    </h3>
                    <p className="text-gray-600 mt-1">{alert.message}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span>
                        Spend: <strong>${alert.current_spend.toFixed(2)}</strong>
                      </span>
                      <span>
                        Budget: <strong>${alert.budget_limit.toFixed(2)}</strong>
                      </span>
                      <span>
                        Utilization: <strong>{alert.utilization_percent.toFixed(0)}%</strong>
                      </span>
                      {alert.forecasted_exceed_date && (
                        <span className="text-red-600">
                          Exceeds: {new Date(alert.forecasted_exceed_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {alert.recommendations.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-500">Recommendations:</div>
                        <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                          {alert.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {alert.status === 'active' && (
                      <button
                        onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                        className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => resolveAlertMutation.mutate(alert.id)}
                        className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(!alerts || alerts.length === 0) && (
              <div className="card p-8 text-center text-gray-500">
                No alerts found. Click "Generate New Alerts" to check for budget issues.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
