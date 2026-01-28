import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import clsx from 'clsx'

interface RoutingSettings {
  smart_routing_enabled: boolean
  routing_strategy: string
  available_strategies: Record<string, { description: string; complexity_threshold: number }>
  // RouteLLM settings
  routellm_enabled: boolean
  routellm_threshold: number
  routellm_available: boolean
  routellm_unavailable_reason: string | null
  cascade_routing_enabled: boolean
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

interface TestResult {
  original_model: string
  routed_model: string
  routing_applied: boolean
  complexity_score: number | null
  complexity_reasons: string[]
  task_type: string | null
  task_confidence: number
  semantic_routing_used: boolean
  // RouteLLM fields
  routellm_used: boolean
  routellm_win_rate: number | null
  routellm_confident: boolean
  routing_reason: string
  estimated_savings_usd: number
}

// Sample prompts for quick testing
const SAMPLE_PROMPTS = [
  { label: 'Simple', prompt: 'What is 2 + 2?', expected: 'simple' },
  { label: 'Translation', prompt: 'Translate "Hello world" to Spanish', expected: 'translation' },
  { label: 'Summary', prompt: 'Summarize: The quick brown fox jumps over the lazy dog.', expected: 'summarization' },
  { label: 'Coding', prompt: 'Write a Python function to calculate fibonacci sequence with memoization', expected: 'coding' },
  { label: 'Analysis', prompt: 'Analyze the pros and cons of microservices vs monolithic architecture for a startup', expected: 'analysis' },
  { label: 'Reasoning', prompt: 'If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Explain your reasoning step by step.', expected: 'reasoning' },
]

// Task type colors and icons
const TASK_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  coding: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '{ }' },
  analysis: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '📊' },
  reasoning: { bg: 'bg-amber-100', text: 'text-amber-800', icon: '🧠' },
  creative: { bg: 'bg-pink-100', text: 'text-pink-800', icon: '✨' },
  translation: { bg: 'bg-green-100', text: 'text-green-800', icon: '🌐' },
  summarization: { bg: 'bg-teal-100', text: 'text-teal-800', icon: '📝' },
  extraction: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🔍' },
  simple: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '💬' },
}

// Scoring factor visualization component
function ScoringBreakdown({ result }: { result: TestResult }) {
  const [animationComplete, setAnimationComplete] = useState(false)

  useEffect(() => {
    setAnimationComplete(false)
    const timer = setTimeout(() => setAnimationComplete(true), 500)
    return () => clearTimeout(timer)
  }, [result])

  const complexityPercent = (result.complexity_score || 0) * 100
  const taskStyle = result.task_type ? TASK_STYLES[result.task_type] || TASK_STYLES.simple : TASK_STYLES.simple

  // Parse ML-based complexity reasons into visual factors
  const factors = result.complexity_reasons.map(reason => {
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral'
    let value = 0

    if (reason.includes('ML Task:') || reason.includes('Task:')) {
      // ML Task classification impact (primary signal)
      const isComplex = reason.includes('premium')
      impact = isComplex ? 'positive' : 'negative'
      value = 25
    } else if (reason.includes('Long context')) {
      impact = 'positive'
      value = 5
    } else if (reason.includes('Multi-turn')) {
      impact = 'positive'
      value = 5
    } else if (reason.includes('unavailable')) {
      impact = 'neutral'
      value = 0
    }

    return { reason, impact, value }
  })

  return (
    <div className="space-y-6">
      {/* Main Score Display */}
      <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
        <div className="text-sm text-gray-500 mb-2">Complexity Score</div>
        <div className="relative w-32 h-32 mx-auto mb-4">
          {/* Circular progress */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke={complexityPercent > 50 ? '#8b5cf6' : '#10b981'}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${animationComplete ? complexityPercent * 3.52 : 0} 352`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">
              {complexityPercent.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className={clsx(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
          complexityPercent > 50 ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
        )}>
          {complexityPercent > 50 ? '🔥 Complex Query' : '✨ Simple Query'}
        </div>
      </div>

      {/* RouteLLM Win-Rate (if used) */}
      {result.routellm_used && result.routellm_win_rate !== null && (
        <div className="p-4 border border-pink-200 rounded-lg bg-gradient-to-br from-pink-50 to-purple-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">RouteLLM ML Prediction</span>
            <span className={clsx(
              "px-2 py-0.5 text-xs rounded-full font-medium",
              result.routellm_confident
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            )}>
              {result.routellm_confident ? 'Confident' : 'Uncertain'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-xl">
              🤖
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-gray-900">
                {(result.routellm_win_rate * 100).toFixed(1)}% Win-Rate
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-700"
                    style={{ width: `${animationComplete ? result.routellm_win_rate * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  P(strong wins)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Classification */}
      {result.task_type && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">ML Task Classification</span>
            {result.semantic_routing_used && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                Semantic AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-12 h-12 rounded-lg flex items-center justify-center text-xl',
              taskStyle.bg
            )}>
              {taskStyle.icon}
            </div>
            <div className="flex-1">
              <div className={clsx('text-lg font-semibold capitalize', taskStyle.text)}>
                {result.task_type}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all duration-700', taskStyle.bg.replace('100', '500'))}
                    style={{ width: `${animationComplete ? result.task_confidence * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {(result.task_confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ML Scoring Factors */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <div className="text-sm font-medium text-gray-700 mb-3">ML Scoring Factors</div>
        <div className="space-y-2">
          {factors.map((factor, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                factor.impact === 'positive' ? 'bg-red-100 text-red-600' :
                factor.impact === 'negative' ? 'bg-green-100 text-green-600' :
                'bg-gray-100 text-gray-600'
              )}>
                {factor.impact === 'positive' ? '+' : factor.impact === 'negative' ? '-' : '='}
              </div>
              <div className="flex-1 text-gray-700">{factor.reason}</div>
              {factor.value > 0 && (
                <div className={clsx(
                  'text-xs font-medium',
                  factor.impact === 'positive' ? 'text-red-600' : 'text-green-600'
                )}>
                  {factor.impact === 'positive' ? '+' : '-'}{factor.value}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Animated routing flow visualization
function RoutingFlowVisualization({ result, isLoading }: { result: TestResult | null; isLoading: boolean }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isLoading) {
      setStep(1)
      const t1 = setTimeout(() => setStep(2), 400)
      const t2 = setTimeout(() => setStep(3), 800)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    } else if (result) {
      setStep(4)
    } else {
      setStep(0)
    }
  }, [isLoading, result])

  return (
    <div className="p-6 bg-gray-900 rounded-xl text-white">
      <div className="flex items-center gap-2 mb-6">
        <div className={clsx(
          'w-2 h-2 rounded-full transition-colors',
          step > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
        )} />
        <span className="text-sm text-gray-400">Routing Pipeline</span>
      </div>

      <div className="space-y-4">
        {/* Step 1: Input */}
        <div className={clsx(
          'flex items-center gap-4 transition-opacity duration-300',
          step >= 1 ? 'opacity-100' : 'opacity-40'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            step >= 1 ? 'bg-blue-500' : 'bg-gray-700'
          )}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Request Received</div>
            <div className="text-xs text-gray-500">Model: {result?.original_model || 'gpt-4o'}</div>
          </div>
          {step >= 1 && <div className="w-2 h-2 rounded-full bg-green-400" />}
        </div>

        {/* Connector */}
        <div className="ml-5 w-0.5 h-4 bg-gray-700" />

        {/* Step 2: Semantic Analysis */}
        <div className={clsx(
          'flex items-center gap-4 transition-opacity duration-300',
          step >= 2 ? 'opacity-100' : 'opacity-40'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            step >= 2 ? 'bg-purple-500' : 'bg-gray-700'
          )}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Semantic Classification</div>
            <div className="text-xs text-gray-500">
              {step >= 2 && result?.task_type ? (
                <span className="text-purple-400">Detected: {result.task_type}</span>
              ) : (
                'Analyzing with ML embeddings...'
              )}
            </div>
          </div>
          {step >= 2 && <div className="w-2 h-2 rounded-full bg-purple-400" />}
        </div>

        {/* Connector */}
        <div className="ml-5 w-0.5 h-4 bg-gray-700" />

        {/* Step 3: ML Complexity Scoring */}
        <div className={clsx(
          'flex items-center gap-4 transition-opacity duration-300',
          step >= 3 ? 'opacity-100' : 'opacity-40'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            step >= 3 ? 'bg-amber-500' : 'bg-gray-700'
          )}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">ML Complexity Score</div>
            <div className="text-xs text-gray-500">
              {step >= 3 && result && result.complexity_score !== null ? (
                <span className="text-amber-400">Score: {((result.complexity_score || 0) * 100).toFixed(0)}%</span>
              ) : (
                'Computing ML-based complexity score...'
              )}
            </div>
          </div>
          {step >= 3 && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>

        {/* Connector */}
        <div className="ml-5 w-0.5 h-4 bg-gray-700" />

        {/* Step 3.5: RouteLLM Prediction (if used) */}
        {result?.routellm_used && (
          <>
            <div className={clsx(
              'flex items-center gap-4 transition-opacity duration-300',
              step >= 3 ? 'opacity-100' : 'opacity-40'
            )}>
              <div className={clsx(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                step >= 3 ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-gray-700'
              )}>
                <span className="text-lg">🤖</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">RouteLLM ML Prediction</div>
                <div className="text-xs text-gray-500">
                  {step >= 3 && result.routellm_win_rate !== null ? (
                    <span className="text-pink-400">
                      P(strong wins) = {(result.routellm_win_rate * 100).toFixed(1)}%
                      {result.routellm_confident && (
                        <span className="ml-2 px-1.5 py-0.5 bg-green-900/50 rounded text-green-400 text-xs">
                          Confident
                        </span>
                      )}
                    </span>
                  ) : (
                    'Running ML prediction...'
                  )}
                </div>
              </div>
              {step >= 3 && <div className="w-2 h-2 rounded-full bg-pink-400" />}
            </div>
            <div className="ml-5 w-0.5 h-4 bg-gray-700" />
          </>
        )}

        {/* Step 4: Routing Decision */}
        <div className={clsx(
          'flex items-center gap-4 transition-opacity duration-300',
          step >= 4 ? 'opacity-100' : 'opacity-40'
        )}>
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            step >= 4 ? (result?.routing_applied ? 'bg-green-500' : 'bg-gray-500') : 'bg-gray-700'
          )}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Routing Decision</div>
            <div className="text-xs text-gray-500">
              {step >= 4 && result ? (
                result.routing_applied ? (
                  <span className="text-green-400">Routed to {result.routed_model} (Save ${result.estimated_savings_usd.toFixed(4)})</span>
                ) : (
                  <span className="text-gray-400">Using original model</span>
                )
              ) : (
                'Determining optimal model...'
              )}
            </div>
          </div>
          {step >= 4 && (
            <div className={clsx(
              'w-2 h-2 rounded-full',
              result?.routing_applied ? 'bg-green-400' : 'bg-gray-400'
            )} />
          )}
        </div>
      </div>
    </div>
  )
}

export default function SmartRouting() {
  const queryClient = useQueryClient()
  const [testPrompt, setTestPrompt] = useState('')
  const [testModel, setTestModel] = useState('gpt-4o')
  const [showPlayground, setShowPlayground] = useState(true)

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
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const message = error.response?.data?.detail || error.message || 'Failed to update settings'
      alert(`Error: ${message}`)
      // Refetch to reset UI to server state
      queryClient.invalidateQueries({ queryKey: ['routing-settings'] })
    },
  })

  // Test routing mutation
  const testRoutingMutation = useMutation({
    mutationFn: async ({ model, messages }: { model: string; messages: { role: string; content: string }[] }) => {
      const response = await apiClient.post('/routing/test', { model, messages })
      return response.data as TestResult
    },
  })

  const handleTestRouting = () => {
    if (!testPrompt.trim()) return
    testRoutingMutation.mutate({
      model: testModel,
      messages: [{ role: 'user', content: testPrompt }],
    })
  }

  const handleSamplePrompt = (prompt: string) => {
    setTestPrompt(prompt)
    testRoutingMutation.mutate({
      model: testModel,
      messages: [{ role: 'user', content: prompt }],
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
          ML-powered routing using RouteLLM and semantic classification - no keyword heuristics, just AI
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
              disabled={updateSettingsMutation.isPending}
              onChange={(e) => updateSettingsMutation.mutate({ smart_routing_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className={clsx(
              "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600",
              updateSettingsMutation.isPending && "opacity-50"
            )}></div>
            <span className="ml-3 text-sm font-medium text-gray-900">
              {updateSettingsMutation.isPending ? 'Updating...' : (settings?.smart_routing_enabled ? 'Enabled' : 'Disabled')}
            </span>
          </label>
        </div>

        {settings?.smart_routing_enabled && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Routing Strategy</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings?.available_strategies && Object.entries(settings.available_strategies).map(([key, value]) => {
                  const strategy = value as { description?: string; complexity_threshold?: number }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSettingsMutation.mutate({ routing_strategy: key })}
                      className={clsx(
                        'p-4 rounded-lg border-2 text-left transition-colors cursor-pointer',
                        settings.routing_strategy === key
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-gray-500 mt-1">{strategy.description || 'No description'}</div>
                      <div className="text-xs text-gray-400 mt-2">
                        Threshold: {((strategy.complexity_threshold || 0) * 100).toFixed(0)}%
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* RouteLLM ML Router Settings */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-md font-semibold text-gray-900">RouteLLM ML Router</h3>
                  <p className="text-sm text-gray-500">
                    Use ML-based win-rate prediction for smarter routing decisions
                    {!settings.routellm_available && settings.routellm_unavailable_reason && (
                      <span className="ml-2 text-amber-600">
                        ({settings.routellm_unavailable_reason.includes('API_KEY')
                          ? 'Requires OPENAI_API_KEY'
                          : settings.routellm_unavailable_reason.includes('not installed')
                            ? 'Not installed on server'
                            : 'Unavailable'})
                      </span>
                    )}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.routellm_enabled ?? false}
                    disabled={!settings.routellm_available}
                    onChange={(e) => updateSettingsMutation.mutate({ routellm_enabled: e.target.checked } as Partial<RoutingSettings>)}
                    className="sr-only peer"
                  />
                  <div className={clsx(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600",
                    !settings.routellm_available && "opacity-50 cursor-not-allowed"
                  )}></div>
                </label>
              </div>

              {settings.routellm_enabled && settings.routellm_available && (
                <div className="space-y-4 pl-4 border-l-2 border-purple-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Win-Rate Threshold: {(settings.routellm_threshold * 100).toFixed(1)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.routellm_threshold}
                      onChange={(e) => updateSettingsMutation.mutate({
                        routellm_threshold: parseFloat(e.target.value)
                      } as Partial<RoutingSettings>)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>More savings (route aggressively)</span>
                      <span>Higher quality (route conservatively)</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    RouteLLM predicts P(strong model wins). Requests below threshold route to cheaper models.
                    Default 11.6% achieves ~85% cost savings at 95% quality.
                  </p>
                </div>
              )}
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

      {/* Routing Playground - Interactive Testing */}
      <div className="card overflow-hidden">
        <div
          className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white cursor-pointer flex items-center justify-between"
          onClick={() => setShowPlayground(!showPlayground)}
        >
          <div>
            <h2 className="text-lg font-semibold">Routing Playground</h2>
            <p className="text-sm text-indigo-200">Test prompts and see ML-powered routing in action</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-white/20 rounded text-xs">Interactive Demo</span>
            <svg className={clsx('w-5 h-5 transition-transform', showPlayground && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {showPlayground && (
          <div className="p-6">
            {/* Sample Prompts */}
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-700 mb-3">Quick Test Prompts</div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => handleSamplePrompt(sample.prompt)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      testPrompt === sample.prompt
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Input */}
            <div className="flex gap-4 mb-6">
              <select
                value={testModel}
                onChange={(e) => setTestModel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                {models?.filter(m => m.tier === 'premium').map((m) => (
                  <option key={m.model} value={m.model}>{m.model}</option>
                ))}
              </select>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a test prompt or click a quick test above..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={2}
              />
              <button
                onClick={handleTestRouting}
                disabled={!testPrompt.trim() || testRoutingMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {testRoutingMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing
                  </span>
                ) : 'Test Route'}
              </button>
            </div>

            {/* Results - Two Column Layout */}
            {(testRoutingMutation.isPending || testRoutingMutation.data) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Routing Flow */}
                <RoutingFlowVisualization
                  result={testRoutingMutation.data || null}
                  isLoading={testRoutingMutation.isPending}
                />

                {/* Right: Scoring Breakdown */}
                {testRoutingMutation.data && (
                  <ScoringBreakdown result={testRoutingMutation.data} />
                )}
              </div>
            )}

            {/* Final Result Card */}
            {testRoutingMutation.data && (
              <div className={clsx(
                'mt-6 p-4 rounded-lg border-2',
                testRoutingMutation.data.routing_applied
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-200'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      testRoutingMutation.data.routing_applied ? 'bg-green-100' : 'bg-gray-100'
                    )}>
                      {testRoutingMutation.data.routing_applied ? (
                        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {testRoutingMutation.data.routing_applied
                          ? `Routed to ${testRoutingMutation.data.routed_model}`
                          : `Using ${testRoutingMutation.data.original_model}`
                        }
                      </div>
                      <div className="text-sm text-gray-600">
                        {testRoutingMutation.data.routing_reason}
                      </div>
                    </div>
                  </div>
                  {testRoutingMutation.data.routing_applied && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${testRoutingMutation.data.estimated_savings_usd.toFixed(4)}
                      </div>
                      <div className="text-xs text-green-600">estimated savings</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Distribution */}
      {stats?.model_distribution && Object.keys(stats.model_distribution).length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Distribution</h2>
          <div className="space-y-4">
            {Object.entries(stats.model_distribution).map(([model, count], index) => {
              const total = Object.values(stats.model_distribution).reduce((a, b) => a + b, 0)
              const percentage = (count / total) * 100
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
