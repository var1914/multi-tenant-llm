import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import apiClient from '../../api/client'

interface DailyUsage {
  date: string
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

export default function UsageChart() {
  const { data: dailyUsage, isLoading } = useQuery<DailyUsage[]>({
    queryKey: ['daily-usage'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/daily?days=30')
      return response.data
    },
  })

  const chartData = dailyUsage?.map((d) => ({
    date: d.date.split('-').slice(1).join('/'),
    tokens: d.total_quantity,
    cost: parseFloat(d.total_cost_usd),
  }))

  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        Loading usage data...
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No usage data yet</p>
          <p className="text-sm mt-1">Start tracking usage to see your chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => v.toLocaleString()} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              name === 'tokens' ? value.toLocaleString() : `$${value.toFixed(2)}`,
              name === 'tokens' ? 'Tokens' : 'Cost',
            ]}
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorTokens)"
            name="tokens"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
