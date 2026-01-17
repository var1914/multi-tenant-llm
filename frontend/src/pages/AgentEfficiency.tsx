import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import apiClient from '../api/client'

interface AgentMetrics {
  agent_name: string
  total_invocations: number
  successful_invocations: number
  total_tokens: number
  total_cost: number
  avg_cost_per_call: number
  success_rate: number
  efficiency_score: number
  recommendations: Array<{
    type: string
    message: string
    impact: string
  }>
}

interface Recommendation {
  agent_name: string
  type: string
  message: string
  impact: string
  potential_savings: number | null
}

interface OutcomePricing {
  id: string
  workflow_type: string
  billing_model: string
  price_per_success: number | null
  free_attempts: number
  is_active: boolean
}

interface AgentComparison {
  total_agents: number
  best_performer: { name: string; score: number } | null
  worst_performer: { name: string; score: number } | null
  average_efficiency: number
  total_cost: number
  agents_needing_attention: string[]
}

type TabType = 'efficiency' | 'pricing' | 'recommendations'

export default function AgentEfficiency() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('efficiency')
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [pricingForm, setPricingForm] = useState({
    workflow_type: '',
    billing_model: 'per_outcome',
    price_per_success: '',
    free_attempts: '0',
  })

  // Fetch agent efficiency metrics
  const { data: agents, isLoading: agentsLoading } = useQuery<AgentMetrics[]>({
    queryKey: ['agent-efficiency'],
    queryFn: async () => {
      const response = await apiClient.get('/agentic/efficiency/agents?days=30')
      return response.data
    },
  })

  // Fetch comparison summary
  const { data: comparison } = useQuery<AgentComparison>({
    queryKey: ['agent-comparison'],
    queryFn: async () => {
      const response = await apiClient.get('/agentic/efficiency/comparison?days=30')
      return response.data
    },
  })

  // Fetch recommendations
  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ['agent-recommendations'],
    queryFn: async () => {
      const response = await apiClient.get('/agentic/efficiency/recommendations?days=30')
      return response.data
    },
  })

  // Fetch outcome pricing
  const { data: pricing } = useQuery<OutcomePricing[]>({
    queryKey: ['outcome-pricing'],
    queryFn: async () => {
      const response = await apiClient.get('/agentic/outcome-pricing')
      return response.data
    },
  })

  // Create pricing mutation
  const createPricingMutation = useMutation({
    mutationFn: async (data: typeof pricingForm) => {
      const response = await apiClient.post('/agentic/outcome-pricing', {
        workflow_type: data.workflow_type,
        billing_model: data.billing_model,
        price_per_success: data.price_per_success ? parseFloat(data.price_per_success) : null,
        free_attempts: parseInt(data.free_attempts) || 0,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outcome-pricing'] })
      toast.success('Pricing rule created')
      setShowPricingModal(false)
      setPricingForm({ workflow_type: '', billing_model: 'per_outcome', price_per_success: '', free_attempts: '0' })
    },
    onError: () => {
      toast.error('Failed to create pricing rule')
    },
  })

  // Delete pricing mutation
  const deletePricingMutation = useMutation({
    mutationFn: async (workflowType: string) => {
      await apiClient.delete(`/agentic/outcome-pricing/${workflowType}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outcome-pricing'] })
      toast.success('Pricing rule deleted')
    },
  })

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Efficiency & Billing</h1>
        <p className="text-gray-600">Monitor agent performance and configure outcome-based pricing</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total Agents</div>
          <div className="text-2xl font-bold">{comparison?.total_agents || 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Average Efficiency</div>
          <div className="text-2xl font-bold">{comparison?.average_efficiency?.toFixed(0) || 0}%</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total Cost (30d)</div>
          <div className="text-2xl font-bold">${comparison?.total_cost?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Needs Attention</div>
          <div className="text-2xl font-bold text-red-600">
            {comparison?.agents_needing_attention?.length || 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['efficiency', 'pricing', 'recommendations'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'efficiency' ? 'Agent Efficiency' : tab === 'pricing' ? 'Outcome Pricing' : 'Recommendations'}
            </button>
          ))}
        </nav>
      </div>

      {/* Efficiency Tab */}
      {activeTab === 'efficiency' && (
        <div className="card">
          {agentsLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : agents?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No agent data yet. Start tracking workflows to see efficiency metrics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invocations</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agents?.map((agent) => (
                    <tr key={agent.agent_name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{agent.agent_name}</div>
                        <div className="text-xs text-gray-500">{agent.total_tokens.toLocaleString()} tokens</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreColor(agent.efficiency_score)}`}>
                          {agent.efficiency_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {agent.total_invocations}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={agent.success_rate < 80 ? 'text-red-600' : 'text-gray-900'}>
                          {agent.success_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        ${agent.avg_cost_per_call.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ${agent.total_cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {agent.recommendations.length > 0 ? (
                          <div className="flex gap-1">
                            {agent.recommendations.slice(0, 2).map((rec, i) => (
                              <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getImpactColor(rec.impact)}`}>
                                {rec.type.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-green-600 text-sm">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowPricingModal(true)} className="btn btn-primary">
              Add Pricing Rule
            </button>
          </div>

          <div className="card">
            {pricing?.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No outcome pricing configured. Add a pricing rule to bill by successful outcomes.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workflow Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing Model</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/Success</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Free Attempts</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pricing?.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rule.workflow_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rule.billing_model.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ${rule.price_per_success?.toFixed(4) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {rule.free_attempts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => deletePricingMutation.mutate(rule.workflow_type)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="card">
          {recommendations?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No optimization recommendations. Your agents are performing well!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recommendations?.map((rec, i) => (
                <div key={i} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rec.agent_name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getImpactColor(rec.impact)}`}>
                          {rec.impact}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{rec.message}</p>
                    </div>
                    {rec.potential_savings && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Potential Savings</div>
                        <div className="text-lg font-medium text-green-600">
                          ${rec.potential_savings.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Outcome Pricing</h2>
            <form onSubmit={(e) => { e.preventDefault(); createPricingMutation.mutate(pricingForm); }} className="space-y-4">
              <div>
                <label className="label">Workflow Type *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g., code_review, research"
                  value={pricingForm.workflow_type}
                  onChange={(e) => setPricingForm({ ...pricingForm, workflow_type: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Billing Model</label>
                <select
                  className="input"
                  value={pricingForm.billing_model}
                  onChange={(e) => setPricingForm({ ...pricingForm, billing_model: e.target.value })}
                >
                  <option value="per_outcome">Per Outcome</option>
                  <option value="tiered_outcome">Tiered</option>
                </select>
              </div>
              <div>
                <label className="label">Price per Success ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input"
                  placeholder="e.g., 0.10"
                  value={pricingForm.price_per_success}
                  onChange={(e) => setPricingForm({ ...pricingForm, price_per_success: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Free Attempts</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={pricingForm.free_attempts}
                  onChange={(e) => setPricingForm({ ...pricingForm, free_attempts: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowPricingModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={createPricingMutation.isPending} className="btn btn-primary">
                  {createPricingMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
