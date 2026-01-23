import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// Current API pricing (January 2026) - per million tokens
// Sources: OpenAI, Anthropic, Google, Mistral, Groq official pricing pages
const MODEL_PRICING = {
  // OpenAI
  'gpt-4o': { provider: 'OpenAI', input: 2.50, output: 10.00, tier: 'premium' },
  'gpt-4o-mini': { provider: 'OpenAI', input: 0.15, output: 0.60, tier: 'budget' },
  // Anthropic
  'claude-3.5-sonnet': { provider: 'Anthropic', input: 3.00, output: 15.00, tier: 'premium' },
  'claude-3-haiku': { provider: 'Anthropic', input: 0.25, output: 1.25, tier: 'budget' },
  // Google
  'gemini-1.5-pro': { provider: 'Google', input: 1.25, output: 5.00, tier: 'premium' },
  'gemini-1.5-flash': { provider: 'Google', input: 0.15, output: 0.60, tier: 'budget' },
  'gemini-2.0-flash': { provider: 'Google', input: 0.10, output: 0.40, tier: 'budget' },
  // Mistral
  'mistral-large': { provider: 'Mistral', input: 2.00, output: 6.00, tier: 'premium' },
  // Open Source (via Groq)
  'llama-3.1-70b': { provider: 'Groq', input: 0.59, output: 0.79, tier: 'mid' },
  'llama-3.1-8b': { provider: 'Groq', input: 0.05, output: 0.08, tier: 'budget' },
} as const

type ModelKey = keyof typeof MODEL_PRICING

const MODEL_DISPLAY_NAMES: Record<ModelKey, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'mistral-large': 'Mistral Large',
  'llama-3.1-70b': 'Llama 3.1 70B',
  'llama-3.1-8b': 'Llama 3.1 8B',
}

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: '#10a37f',
  Anthropic: '#d4a574',
  Google: '#4285f4',
  Mistral: '#ff7000',
  Groq: '#f55036',
}

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function PricingCalculator() {
  const [requestsPerMonth, setRequestsPerMonth] = useState(100000) // 100K default
  const [avgTokensPerRequest, setAvgTokensPerRequest] = useState(2000) // 2K tokens
  const [inputOutputRatio, setInputOutputRatio] = useState(0.25) // 25% input, 75% output
  const [selectedModel, setSelectedModel] = useState<ModelKey>('gpt-4o')
  const [smartRoutingEnabled, setSmartRoutingEnabled] = useState(true)

  // Calculate costs
  const calculations = useMemo(() => {
    const totalTokens = requestsPerMonth * avgTokensPerRequest
    const inputTokens = totalTokens * inputOutputRatio
    const outputTokens = totalTokens * (1 - inputOutputRatio)

    // Cost for selected model
    const model = MODEL_PRICING[selectedModel]
    const selectedModelCost = (inputTokens / 1_000_000) * model.input + (outputTokens / 1_000_000) * model.output

    // Smart routing: route 40% of simple queries to budget model
    const smartRoutingSimpleRatio = 0.4
    const budgetModel = selectedModel.includes('gpt') ? 'gpt-4o-mini'
      : selectedModel.includes('claude') ? 'claude-3-haiku'
      : selectedModel.includes('gemini') ? 'gemini-2.0-flash'
      : selectedModel.includes('mistral') ? 'llama-3.1-70b'
      : 'llama-3.1-8b'

    const budget = MODEL_PRICING[budgetModel as ModelKey]

    const complexInputTokens = inputTokens * (1 - smartRoutingSimpleRatio)
    const complexOutputTokens = outputTokens * (1 - smartRoutingSimpleRatio)
    const simpleInputTokens = inputTokens * smartRoutingSimpleRatio
    const simpleOutputTokens = outputTokens * smartRoutingSimpleRatio

    const smartRoutingCost = smartRoutingEnabled
      ? (complexInputTokens / 1_000_000) * model.input + (complexOutputTokens / 1_000_000) * model.output +
        (simpleInputTokens / 1_000_000) * budget.input + (simpleOutputTokens / 1_000_000) * budget.output
      : selectedModelCost

    const savings = selectedModelCost - smartRoutingCost
    const savingsPercent = (savings / selectedModelCost) * 100

    // Cost breakdown by all models for comparison
    const allModelCosts = Object.entries(MODEL_PRICING).map(([key, value]) => ({
      name: MODEL_DISPLAY_NAMES[key as ModelKey],
      cost: (inputTokens / 1_000_000) * value.input + (outputTokens / 1_000_000) * value.output,
      provider: value.provider,
      tier: value.tier,
    })).sort((a, b) => a.cost - b.cost)

    // Cost breakdown by provider (pie chart)
    const providerBreakdown = Object.entries(MODEL_PRICING).reduce((acc, [key, value]) => {
      const cost = (inputTokens / 1_000_000) * value.input + (outputTokens / 1_000_000) * value.output
      if (!acc[value.provider]) {
        acc[value.provider] = { provider: value.provider, avgCost: 0, count: 0 }
      }
      acc[value.provider].avgCost += cost
      acc[value.provider].count += 1
      return acc
    }, {} as Record<string, { provider: string; avgCost: number; count: number }>)

    const pieData = Object.values(providerBreakdown).map(p => ({
      name: p.provider,
      value: Math.round(p.avgCost / p.count),
    }))

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      selectedModelCost,
      smartRoutingCost,
      savings,
      savingsPercent,
      allModelCosts,
      pieData,
      budgetModelName: MODEL_DISPLAY_NAMES[budgetModel as ModelKey],
    }
  }, [requestsPerMonth, avgTokensPerRequest, inputOutputRatio, selectedModel, smartRoutingEnabled])

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
    return num.toString()
  }

  const formatCurrency = (num: number) => {
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <section className="py-24 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Calculate Your LLM Costs
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            See exactly what you're spending on AI and how much you could save with smart routing.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Model Selection */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                Primary Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelKey)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {Object.entries(MODEL_PRICING).map(([key, value]) => (
                  <option key={key} value={key}>
                    {MODEL_DISPLAY_NAMES[key as ModelKey]} ({value.provider}) - ${value.input}/${value.output} per 1M
                  </option>
                ))}
              </select>
            </div>

            {/* Requests Slider */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-zinc-300">
                  Requests per Month
                </label>
                <span className="text-green-400 font-mono font-medium">
                  {formatNumber(requestsPerMonth)}
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={10000000}
                step={10000}
                value={requestsPerMonth}
                onChange={(e) => setRequestsPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>10K</span>
                <span>10M</span>
              </div>
            </div>

            {/* Tokens per Request Slider */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-zinc-300">
                  Avg Tokens per Request
                </label>
                <span className="text-green-400 font-mono font-medium">
                  {formatNumber(avgTokensPerRequest)}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={32000}
                step={100}
                value={avgTokensPerRequest}
                onChange={(e) => setAvgTokensPerRequest(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>100</span>
                <span>32K</span>
              </div>
            </div>

            {/* Input/Output Ratio */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-zinc-300">
                  Input/Output Ratio
                </label>
                <span className="text-green-400 font-mono font-medium">
                  {Math.round(inputOutputRatio * 100)}% / {Math.round((1 - inputOutputRatio) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={inputOutputRatio}
                onChange={(e) => setInputOutputRatio(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>More Output</span>
                <span>More Input</span>
              </div>
            </div>

            {/* Smart Routing Toggle */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Smart Routing
                  </label>
                  <p className="text-xs text-zinc-500 mt-1">
                    Route 40% of simple queries to {calculations.budgetModelName}
                  </p>
                </div>
                <button
                  onClick={() => setSmartRoutingEnabled(!smartRoutingEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    smartRoutingEnabled ? 'bg-green-500' : 'bg-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      smartRoutingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            {/* Cost Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Monthly Cost</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(smartRoutingEnabled ? calculations.smartRoutingCost : calculations.selectedModelCost)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatNumber(calculations.totalTokens)} tokens
                </p>
              </div>
              <div className={`p-6 rounded-xl border ${
                smartRoutingEnabled && calculations.savings > 0
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-zinc-800/50 border-zinc-700'
              }`}>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  {smartRoutingEnabled ? 'You Save' : 'Enable Smart Routing'}
                </p>
                <p className={`text-3xl font-bold ${smartRoutingEnabled ? 'text-green-400' : 'text-zinc-500'}`}>
                  {smartRoutingEnabled ? formatCurrency(calculations.savings) : '$0'}
                </p>
                <p className={`text-xs mt-1 ${smartRoutingEnabled ? 'text-green-400' : 'text-zinc-500'}`}>
                  {smartRoutingEnabled ? `${calculations.savingsPercent.toFixed(0)}% reduction` : 'to see savings'}
                </p>
              </div>
            </div>

            {/* Bar Chart: Model Comparison */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Cost by Model (Monthly)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={calculations.allModelCosts.slice(0, 6)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis
                      type="number"
                      stroke="#71717a"
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#71717a"
                      width={75}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Cost']}
                    />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {calculations.allModelCosts.slice(0, 6).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PROVIDER_COLORS[entry.provider] || CHART_COLORS[index]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Provider Breakdown */}
            <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Average Cost by Provider</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={calculations.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {calculations.pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PROVIDER_COLORS[entry.name] || CHART_COLORS[index]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Avg Cost']}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="mt-12 p-6 bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-x-auto">
          <h3 className="text-lg font-semibold text-white mb-4">Current API Pricing (January 2026)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Model</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Provider</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Input (per 1M)</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Output (per 1M)</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODEL_PRICING).map(([key, value]) => (
                <tr key={key} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="py-3 px-4 text-white font-medium">
                    {MODEL_DISPLAY_NAMES[key as ModelKey]}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${PROVIDER_COLORS[value.provider]}20`,
                        color: PROVIDER_COLORS[value.provider]
                      }}
                    >
                      {value.provider}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300 font-mono">
                    ${value.input.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300 font-mono">
                    ${value.output.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      value.tier === 'premium' ? 'bg-yellow-500/20 text-yellow-400' :
                      value.tier === 'mid' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {value.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-zinc-500 mt-4">
            * Prices sourced from official provider pricing pages. Last updated: January 2026.
          </p>
        </div>
      </div>
    </section>
  )
}
