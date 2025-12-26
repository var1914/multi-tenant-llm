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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back{tenant?.company_name ? `, ${tenant.company_name}` : ''}
        </p>
      </div>

      <RealtimeStatsBar />

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Usage Overview</h2>
          <UsageChart />
        </div>

        <LiveActivityFeed />
      </div>
    </div>
  )
}
