import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import clsx from 'clsx'

interface RoutingSettings {
  smart_routing_enabled: boolean
  routing_strategy: string
  available_strategies: Record<string, { description: string; complexity_threshold: number }>
}

interface RoutingStats {
  period_days: number
  total_decisions: number
  routed_decisions: number
  routing_rate: number
  total_estimated_savings_usd: number
  average_complexity_score: number
  model_distribution: Record<string, number>
}

interface RoutingDecision {
  id: string
  event_timestamp: string
  original_model: string
  routed_model: string
  routing_applied: boolean
  routing_reason: string | null
  complexity_score: number | null
  complexity_reasons: string[]
  estimated_savings_usd: number
  request_id: string | null
}

interface ModelCost {
  model: string
  provider: string
  tier: string
  input_cost_per_1m: number
  output_cost_per_1m: number
}

export default function SmartRouting() {
  const queryClient = useQueryClient()
  const [testPrompt, setTestPrompt] = useState('')
  const [testModel, setTestModel] = useState('gpt-4o')

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery<RoutingSettings>({
    queryKey: ['routing-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/routing/settings')
      return response.data
    },
  })

  // Fetch stats
  const { data: stats } = useQuery<RoutingStats>({
    queryKey: ['routing-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/routing/stats?days=30')
      return response.data
    },
  })

  // Fetch recent decisions
  const { data: decisions } = useQuery<RoutingDecision[]>({
    queryKey: ['routing-decisions'],
    queryFn: async () => {
      const response = await apiClient.get('/routing/decisions?limit=20')
      return response.data
    },
  })

  // Fetch supported models
  const { data: models } = useQuery<ModelCost[]>({
    queryKey: ['routing-models'],
    queryFn: async () => {
      const response = await apiClient.get('/routing/models')
      return response.data
    },
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<RoutingSettings>) => {
      const response = await apiClient.put('/routing/settings', newSettings)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-settings'] })
    },
  })

  // Test routing mutation
  const testRoutingMutation = useMutation({
    mutationFn: async ({ model, messages }: { model: string; messages: { role: string; content: string }[] }) => {
      const response = await apiClient.post('/routing/test', { model, messages })
      return response.data
    },
  })

  const handleTestRouting = () => {
    if (!testPrompt.trim()) return
    testRoutingMutation.mutate({
      model: testModel,
      messages: [{ role: 'user', content: testPrompt }],
    })
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Smart Routing</h1>
        <p className="text-gray-600">
          Automatically route requests to optimal models based on complexity
        </p>
      </div>

      {/* Settings Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Routing Settings</h2>
            <p className="text-sm text-gray-500">Configure how requests are routed to different models</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.smart_routing_enabled ?? false}
              onChange={(e) => updateSettingsMutation.mutate({ smart_routing_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900">
              {settings?.smart_routing_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {settings?.smart_routing_enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Routing Strategy</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {settings?.available_strategies && Object.entries(settings.available_strategies).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => updateSettingsMutation.mutate({ routing_strategy: key })}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-colors',
                      settings.routing_strategy === key
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="font-medium capitalize">{key.replace('_', ' ')}</div>
                    <div className="text-sm text-gray-500 mt-1">{value.description}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      Threshold: {(value.complexity_threshold * 100).toFixed(0)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm font-medium text-gray-500">Total Decisions (30d)</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total_decisions.toLocaleString()}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm font-medium text-gray-500">Routing Rate</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{stats.routing_rate.toFixed(1)}%</div>
          </div>
          <div className="card p-5">
            <div className="text-sm font-medium text-gray-500">Estimated Savings</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              ${stats.total_estimated_savings_usd.toFixed(2)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm font-medium text-gray-500">Avg Complexity</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{(stats.average_complexity_score * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* Model Distribution */}
      {stats?.model_distribution && Object.keys(stats.model_distribution).length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Distribution</h2>
          <div className="space-y-4">
            {Object.entries(stats.model_distribution).map(([model, count], index) => {
              const total = Object.values(stats.model_distribution).reduce((a, b) => a + b, 0)
              const percentage = (count / total) * 100
              // Gradient colors for each bar
              const colors = ['from-indigo-400 to-indigo-500', 'from-violet-400 to-violet-500', 'from-purple-400 to-purple-500', 'from-blue-400 to-blue-500', 'from-cyan-400 to-cyan-500']
              const colorClass = colors[index % colors.length]
              return (
                <div key={model}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{model}</span>
                    <span className="text-gray-500 font-medium">{count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Test Routing */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Test Routing</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter a prompt to see how it would be routed based on complexity analysis
        </p>
        <div className="space-y-4">
          <div className="flex gap-4">
            <select
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {models?.filter(m => m.tier === 'premium').map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </select>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a test prompt..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={2}
            />
            <button
              onClick={handleTestRouting}
              disabled={!testPrompt.trim() || testRoutingMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testRoutingMutation.isPending ? 'Testing...' : 'Test'}
            </button>
          </div>

          {testRoutingMutation.data && (
            <div className={clsx(
              'p-4 rounded-lg border',
              testRoutingMutation.data.routing_applied
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            )}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Original Model</div>
                  <div className="font-medium">{testRoutingMutation.data.original_model}</div>
                </div>
                <div>
                  <div className="text-gray-500">Routed Model</div>
                  <div className={clsx(
                    'font-medium',
                    testRoutingMutation.data.routing_applied ? 'text-green-600' : ''
                  )}>
                    {testRoutingMutation.data.routed_model}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Complexity Score</div>
                  <div className="font-medium">
                    {testRoutingMutation.data.complexity_score
                      ? (testRoutingMutation.data.complexity_score * 100).toFixed(0) + '%'
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Est. Savings</div>
                  <div className="font-medium text-emerald-600">
                    ${testRoutingMutation.data.estimated_savings_usd.toFixed(4)}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm">
                <div className="text-gray-500">Routing Reason</div>
                <div className="text-gray-700">{testRoutingMutation.data.routing_reason}</div>
              </div>
              {testRoutingMutation.data.complexity_reasons?.length > 0 && (
                <div className="mt-2">
                  <div className="text-gray-500 text-sm">Complexity Factors</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {testRoutingMutation.data.complexity_reasons.map((reason: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Routing Decisions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Routing Decisions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Routed To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Complexity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Savings
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {decisions?.map((decision) => (
                <tr key={decision.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(decision.event_timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{decision.original_model}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-medium',
                      decision.routing_applied
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    )}>
                      {decision.routed_model}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {decision.complexity_score
                      ? (decision.complexity_score * 100).toFixed(0) + '%'
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-600 font-medium">
                    {decision.routing_applied ? `$${decision.estimated_savings_usd.toFixed(4)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {decision.routing_reason || '-'}
                  </td>
                </tr>
              ))}
              {(!decisions || decisions.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No routing decisions yet. Enable smart routing to start optimizing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supported Models */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Supported Models & Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['openai', 'anthropic'].map((provider) => (
            <div key={provider}>
              <h3 className="font-medium capitalize mb-3">{provider}</h3>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="py-2 text-left text-xs font-medium text-gray-500">Model</th>
                    <th className="py-2 text-left text-xs font-medium text-gray-500">Tier</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500">Input/1M</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500">Output/1M</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {models?.filter(m => m.provider === provider).map((m) => (
                    <tr key={m.model}>
                      <td className="py-2 font-medium">{m.model}</td>
                      <td className="py-2">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs',
                          m.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {m.tier}
                        </span>
                      </td>
                      <td className="py-2 text-right">${m.input_cost_per_1m.toFixed(2)}</td>
                      <td className="py-2 text-right">${m.output_cost_per_1m.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
