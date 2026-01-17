import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import StatsCards from '../components/dashboard/StatsCards'
import UsageChart from '../components/dashboard/UsageChart'
import RealtimeStatsBar from '../components/dashboard/RealtimeStatsBar'
import LiveActivityFeed from '../components/dashboard/LiveActivityFeed'

export default function Dashboard() {
  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await apiClient.get('/tenants/current')
      return response.data
    },
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vscode-text">Dashboard</h1>
          <p className="text-vscode-textSecondary">
            Welcome back{tenant?.company_name ? `, ${tenant.company_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-vscode-textMuted">
          <span className="w-2 h-2 rounded-full bg-vscode-success animate-pulse" />
          Live
        </div>
      </div>

      {/* Realtime Stats Bar */}
      <RealtimeStatsBar />

      {/* Stats Cards */}
      <StatsCards />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Usage Overview</h2>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Last 7 days</span>
          </div>
          <UsageChart />
        </div>

        <LiveActivityFeed />
      </div>
    </div>
  )
}
