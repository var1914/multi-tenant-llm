import { useQuery } from '@tanstack/react-query'
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
  AreaChart,
  Area,
} from 'recharts'
import apiClient from '../api/client'

interface ModelUsage {
  model: string
  provider: string
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

interface CustomerUsage {
  customer_id: string
  customer_name: string | null
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

interface DailyUsage {
  date: string
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

interface FeatureUsage {
  event_type: string
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

// Soft, muted color palette for charts
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#a5b4fc', '#c7d2fe']
const SOFT_BLUE = '#6366f1'
const SOFT_INDIGO = '#818cf8'
const SOFT_VIOLET = '#a78bfa'

export default function Analytics() {
  const { data: byModel, isLoading: loadingModels } = useQuery<ModelUsage[]>({
    queryKey: ['usage-by-model'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/by-model')
      return response.data
    },
  })

  const { data: byCustomer, isLoading: loadingCustomers } = useQuery<CustomerUsage[]>({
    queryKey: ['usage-by-customer'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/by-customer')
      return response.data
    },
  })

  const { data: dailyUsage, isLoading: loadingDaily } = useQuery<DailyUsage[]>({
    queryKey: ['daily-usage'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/daily?days=30')
      return response.data
    },
  })

  const { data: byFeature, isLoading: loadingFeatures } = useQuery<FeatureUsage[]>({
    queryKey: ['usage-by-feature'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/by-feature')
      return response.data
    },
  })

  const modelChartData = byModel?.map((m) => ({
    name: m.model,
    provider: m.provider,
    cost: parseFloat(m.total_cost_usd),
    tokens: m.total_quantity,
  }))

  const customerChartData = byCustomer?.map((c) => ({
    name: c.customer_name || c.customer_id,
    cost: parseFloat(c.total_cost_usd),
    tokens: c.total_quantity,
  }))

  const dailyChartData = dailyUsage?.map((d) => ({
    date: d.date.split('-').slice(1).join('/'),
    cost: parseFloat(d.total_cost_usd),
    tokens: d.total_quantity,
  }))

  const providerData = byModel?.reduce(
    (acc, m) => {
      const existing = acc.find((p) => p.name === m.provider)
      if (existing) {
        existing.value += parseFloat(m.total_cost_usd)
      } else {
        acc.push({ name: m.provider, value: parseFloat(m.total_cost_usd) })
      }
      return acc
    },
    [] as { name: string; value: number }[]
  )

  const featureChartData = byFeature?.map((f) => ({
    name: f.event_type,
    cost: parseFloat(f.total_cost_usd),
    events: f.event_count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Detailed usage breakdown and insights</p>
      </div>

      {/* Daily Usage Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Usage Trend</h2>
        {loadingDaily ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : dailyChartData && dailyChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOFT_BLUE} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={SOFT_BLUE} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke={SOFT_BLUE}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No usage data yet
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Model */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Model</h2>
          {loadingModels ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
          ) : modelChartData && modelChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelChartData} layout="vertical">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={SOFT_BLUE} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={SOFT_INDIGO} stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={120} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar dataKey="cost" fill="url(#barGradient)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No model data yet
            </div>
          )}
        </div>

        {/* Cost by Provider (Pie) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Provider</h2>
          {loadingModels ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
          ) : providerData && providerData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providerData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                  >
                    {providerData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No provider data yet
            </div>
          )}
        </div>
      </div>

      {/* Cost by Feature */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cost by Feature</h2>
        <p className="text-sm text-gray-500 mb-4">See which AI features drive the most usage</p>
        {loadingFeatures ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : featureChartData && featureChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureChartData}>
                <defs>
                  <linearGradient id="featureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SOFT_VIOLET} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={SOFT_BLUE} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${v}`} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'cost' ? `$${value.toFixed(2)}` : value,
                    name === 'cost' ? 'Cost' : 'Events',
                  ]}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar dataKey="cost" fill="url(#featureGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No feature data yet
          </div>
        )}
      </div>

      {/* Cost by Customer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Customer</h2>
        {loadingCustomers ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>
        ) : customerChartData && customerChartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerChartData}>
                <defs>
                  <linearGradient id="customerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${v}`} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar dataKey="cost" fill="url(#customerGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No customer data yet
          </div>
        )}
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Details Table */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Model Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {byModel?.map((m) => (
                  <tr key={`${m.provider}-${m.model}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {m.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          m.provider === 'openai'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {m.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {m.total_quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ${parseFloat(m.total_cost_usd).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Details Table */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Customer Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Events
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {byCustomer?.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {c.customer_name || c.customer_id}
                      </div>
                      {c.customer_name && (
                        <div className="text-xs text-gray-500">{c.customer_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {c.event_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {c.total_quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ${parseFloat(c.total_cost_usd).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
