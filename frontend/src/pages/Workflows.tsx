import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import clsx from 'clsx'

interface WorkflowAnalytics {
  total_workflows: number
  completed: number
  failed: number
  running: number
  success_rate: number
  avg_steps: number
  avg_cost_per_workflow: number
  total_cost: number
  total_tokens: number
  workflows: {
    name: string
    type: string
    count: number
    avg_steps: number
    avg_cost: number
    total_cost: number
  }[]
  agents: {
    name: string
    type: string
    invocations: number
    success_rate: number
    avg_tokens: number
    avg_cost: number
    total_cost: number
  }[]
}

interface Workflow {
  id: string
  workflow_id: string
  workflow_name: string | null
  workflow_type: string
  status: string
  started_at: string
  completed_at: string | null
  total_steps: number
  total_llm_calls: number
  total_tool_calls: number
  total_tokens: number
  total_cost_usd: number
  customer_id: string | null
  steps?: {
    step_number: number
    agent_name: string
    agent_type: string
    started_at: string
    completed_at: string | null
    llm_calls: number
    tool_calls: number
    tokens_used: number
    cost_usd: number
    status: string
    output_summary: string | null
  }[]
}

interface WorkflowListResponse {
  workflows: Workflow[]
  total: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  running: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  failed: { bg: 'bg-red-100', text: 'text-red-800' },
  paused: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  paused_over_budget: { bg: 'bg-orange-100', text: 'text-orange-800' },
}

const AGENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'bg-purple-100', text: 'text-purple-800' },
  execution: { bg: 'bg-blue-100', text: 'text-blue-800' },
  verification: { bg: 'bg-teal-100', text: 'text-teal-800' },
}

export default function Workflows() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'list' | 'agents'>('overview')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<WorkflowAnalytics>({
    queryKey: ['workflow-analytics'],
    queryFn: async () => {
      const response = await apiClient.get('/workflows/analytics?days=30')
      return response.data
    },
  })

  // Fetch workflow list
  const { data: workflowList } = useQuery<WorkflowListResponse>({
    queryKey: ['workflows', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const response = await apiClient.get(`/workflows${params}`)
      return response.data
    },
    enabled: selectedTab === 'list' || selectedTab === 'overview',
  })

  // Fetch single workflow details
  const { data: workflowDetail } = useQuery<Workflow>({
    queryKey: ['workflow-detail', selectedWorkflow],
    queryFn: async () => {
      const response = await apiClient.get(`/workflows/${selectedWorkflow}`)
      return response.data
    },
    enabled: !!selectedWorkflow,
  })

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return 'Running...'
    const start = new Date(startedAt)
    const end = new Date(completedAt)
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Workflows</h1>
        <p className="text-gray-600">
          Track multi-step agentic AI workflows and their costs
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'list', 'agents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab)
                setSelectedWorkflow(null)
              }}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm capitalize',
                selectedTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && analytics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-sm text-gray-500">Total Workflows</div>
              <div className="text-2xl font-bold">{analytics.total_workflows}</div>
              <div className="text-xs text-gray-400">Last 30 days</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">Success Rate</div>
              <div className="text-2xl font-bold text-green-600">{analytics.success_rate}%</div>
              <div className="text-xs text-gray-400">
                {analytics.completed} completed, {analytics.failed} failed
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">Avg Steps/Workflow</div>
              <div className="text-2xl font-bold">{analytics.avg_steps.toFixed(1)}</div>
              <div className="text-xs text-gray-400">Multi-agent complexity</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500">Avg Cost/Workflow</div>
              <div className="text-2xl font-bold text-indigo-600">
                ${analytics.avg_cost_per_workflow.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">
                Total: ${analytics.total_cost.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Workflow Status</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-700">{analytics.completed}</div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{analytics.running}</div>
                <div className="text-sm text-blue-600">Running</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-700">{analytics.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-2xl font-bold text-gray-700">
                  {analytics.total_tokens.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Tokens</div>
              </div>
            </div>
          </div>

          {/* Top Workflows by Cost */}
          {analytics.workflows.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Top Workflows by Cost</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Workflow Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Runs
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Avg Steps
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Avg Cost
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {analytics.workflows.map((wf, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-medium">{wf.name}</td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 text-xs bg-gray-100 rounded">{wf.type}</span>
                        </td>
                        <td className="px-4 py-4 text-right">{wf.count}</td>
                        <td className="px-4 py-4 text-right">{wf.avg_steps.toFixed(1)}</td>
                        <td className="px-4 py-4 text-right">${wf.avg_cost.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right font-semibold">${wf.total_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analytics.total_workflows === 0 && (
            <div className="card p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
              <p className="text-gray-500">
                Start tracking agentic workflows using the <code className="px-1 bg-gray-100 rounded">/workflows/start</code> API endpoint.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Workflow List Tab */}
      {selectedTab === 'list' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Workflow Detail Modal */}
          {selectedWorkflow && workflowDetail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">
                      {workflowDetail.workflow_name || workflowDetail.workflow_id}
                    </h2>
                    <p className="text-sm text-gray-500">ID: {workflowDetail.workflow_id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedWorkflow(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Workflow Summary */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Status</div>
                    <span className={clsx(
                      'px-2 py-1 rounded text-sm font-medium',
                      STATUS_COLORS[workflowDetail.status]?.bg,
                      STATUS_COLORS[workflowDetail.status]?.text
                    )}>
                      {workflowDetail.status}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Duration</div>
                    <div className="font-medium">
                      {formatDuration(workflowDetail.started_at, workflowDetail.completed_at)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Total Steps</div>
                    <div className="font-medium">{workflowDetail.total_steps}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Total Cost</div>
                    <div className="font-medium text-indigo-600">
                      ${workflowDetail.total_cost_usd.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Steps Timeline */}
                <h3 className="font-semibold mb-4">Workflow Steps</h3>
                <div className="space-y-3">
                  {workflowDetail.steps?.map((step) => (
                    <div
                      key={step.step_number}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-medium">
                        {step.step_number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{step.agent_name}</span>
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded',
                            AGENT_TYPE_COLORS[step.agent_type]?.bg,
                            AGENT_TYPE_COLORS[step.agent_type]?.text
                          )}>
                            {step.agent_type}
                          </span>
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded',
                            STATUS_COLORS[step.status]?.bg,
                            STATUS_COLORS[step.status]?.text
                          )}>
                            {step.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {step.llm_calls} LLM calls | {step.tool_calls} tool calls | {step.tokens_used.toLocaleString()} tokens | ${step.cost_usd.toFixed(4)}
                        </div>
                        {step.output_summary && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {step.output_summary}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedWorkflow(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Workflows Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Workflow
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Steps
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      LLM Calls
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Tokens
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {workflowList?.workflows.map((workflow) => (
                    <tr
                      key={workflow.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedWorkflow(workflow.workflow_id)}
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium">{workflow.workflow_name || 'Unnamed'}</div>
                        <div className="text-xs text-gray-500">{workflow.workflow_id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                          {workflow.workflow_type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          STATUS_COLORS[workflow.status]?.bg,
                          STATUS_COLORS[workflow.status]?.text
                        )}>
                          {workflow.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">{workflow.total_steps}</td>
                      <td className="px-4 py-4 text-right">{workflow.total_llm_calls}</td>
                      <td className="px-4 py-4 text-right">{workflow.total_tokens.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-medium">
                        ${workflow.total_cost_usd.toFixed(4)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm">
                        {formatDuration(workflow.started_at, workflow.completed_at)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-500">
                        {new Date(workflow.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(!workflowList?.workflows || workflowList.workflows.length === 0) && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No workflows found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Agents Tab */}
      {selectedTab === 'agents' && analytics && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Agent Performance</h2>
            <p className="text-sm text-gray-600 mb-6">
              Performance metrics for each agent type used in your workflows
            </p>

            {analytics.agents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.agents.map((agent, idx) => (
                  <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{agent.name}</h3>
                      <span className={clsx(
                        'px-2 py-0.5 text-xs rounded',
                        AGENT_TYPE_COLORS[agent.type]?.bg,
                        AGENT_TYPE_COLORS[agent.type]?.text
                      )}>
                        {agent.type}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Invocations</span>
                        <span className="font-medium">{agent.invocations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Success Rate</span>
                        <span className={clsx(
                          'font-medium',
                          agent.success_rate >= 90 ? 'text-green-600' :
                          agent.success_rate >= 70 ? 'text-yellow-600' : 'text-red-600'
                        )}>
                          {agent.success_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Tokens</span>
                        <span className="font-medium">{agent.avg_tokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Cost</span>
                        <span className="font-medium">${agent.avg_cost.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-500">Total Cost</span>
                        <span className="font-semibold text-indigo-600">${agent.total_cost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No agent data available yet. Start tracking workflows to see agent performance.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
