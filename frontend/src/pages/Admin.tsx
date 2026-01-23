import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart,
  Line,
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
} from 'recharts'
import apiClient from '../api/client'
import toast from 'react-hot-toast'

interface PlatformStats {
  users: { total: number; active_7d: number; active_30d: number }
  tenants: { total: number }
  customers: { total: number }
  api_keys: { total: number; active: number }
  usage: { total_events: number; total_tokens: number; total_cost_usd: number }
}

interface User {
  id: string
  email: string
  full_name: string | null
  tenant_name: string
  role: string
  is_active: boolean
  created_at: string | null
  last_login_at: string | null
}

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview')
  const [userSearch, setUserSearch] = useState('')
  const queryClient = useQueryClient()

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/stats')
      return response.data
    },
  })

  // Fetch signups over time
  const { data: signups } = useQuery({
    queryKey: ['admin-signups'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/signups?days=30')
      return response.data
    },
  })

  // Fetch usage over time
  const { data: usageOverTime } = useQuery({
    queryKey: ['admin-usage-over-time'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/usage-over-time?days=30')
      return response.data
    },
  })

  // Fetch recent users
  const { data: recentUsers } = useQuery({
    queryKey: ['admin-recent-users'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/recent-users?limit=10')
      return response.data
    },
  })

  // Fetch top tenants
  const { data: topTenants } = useQuery({
    queryKey: ['admin-top-tenants'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/top-tenants?limit=10')
      return response.data
    },
  })

  // Fetch model usage
  const { data: modelUsage } = useQuery({
    queryKey: ['admin-model-usage'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/model-usage')
      return response.data
    },
  })

  // Fetch all users (for users tab)
  const { data: allUsersData } = useQuery({
    queryKey: ['admin-all-users', userSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' })
      if (userSearch) params.append('search', userSearch)
      const response = await apiClient.get(`/admin/users?${params}`)
      return response.data
    },
    enabled: activeTab === 'users',
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { is_active?: boolean; role?: string } }) => {
      const response = await apiClient.patch(`/admin/users/${userId}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-recent-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('User updated successfully')
    },
    onError: () => {
      toast.error('Failed to update user')
    },
  })

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (num: number) => {
    return `$${num.toFixed(2)}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Platform-wide statistics and user management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Users
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              title="Total Users"
              value={stats?.users.total || 0}
              subtitle={`${stats?.users.active_7d || 0} active (7d)`}
              color="blue"
            />
            <StatCard
              title="Tenants"
              value={stats?.tenants.total || 0}
              color="purple"
            />
            <StatCard
              title="Customers"
              value={stats?.customers.total || 0}
              subtitle="End customers"
              color="green"
            />
            <StatCard
              title="API Keys"
              value={stats?.api_keys.total || 0}
              subtitle={`${stats?.api_keys.active || 0} active`}
              color="yellow"
            />
            <StatCard
              title="Total Tokens"
              value={formatNumber(stats?.usage.total_tokens || 0)}
              color="cyan"
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.usage.total_cost_usd || 0)}
              subtitle={`${formatNumber(stats?.usage.total_events || 0)} events`}
              color="emerald"
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Signups Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">User Signups (30 days)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signups || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="signups"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">API Usage (30 days)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageOverTime || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatNumber(value), 'Tokens']}
                    />
                    <Bar dataKey="tokens" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Model Usage Pie Chart & Top Tenants */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Model Usage */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Model</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelUsage?.slice(0, 6) || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="total_cost_usd"
                      nameKey="model"
                      label={({ model }) => model?.split('/').pop() || model}
                    >
                      {(modelUsage?.slice(0, 6) || []).map((_: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Cost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Tenants */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tenants by Usage</h3>
              <div className="space-y-3">
                {(topTenants || []).slice(0, 5).map((tenant: { id: string; company_name: string; total_cost_usd: number; total_tokens: number }, i: number) => (
                  <div key={tenant.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-900">{tenant.company_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(tenant.total_cost_usd)}</div>
                      <div className="text-xs text-gray-500">{formatNumber(tenant.total_tokens)} tokens</div>
                    </div>
                  </div>
                ))}
                {(!topTenants || topTenants.length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">No usage data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Users Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Signups</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Signed Up</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentUsers || []).map((user: User) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          {user.full_name && (
                            <div className="text-xs text-gray-500">{user.full_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{user.tenant_name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(user.created_at)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(user.last_login_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Users Tab */
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">All Users</h3>
            <input
              type="text"
              placeholder="Search by email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Signed Up</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(allUsersData?.users || []).map((user: User) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        {user.full_name && (
                          <div className="text-xs text-gray-500">{user.full_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.tenant_name}</td>
                    <td className="py-3 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserMutation.mutate({ userId: user.id, data: { role: e.target.value } })}
                        className="text-xs px-2 py-1 border border-gray-200 rounded"
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(user.created_at)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => updateUserMutation.mutate({
                          userId: user.id,
                          data: { is_active: !user.is_active }
                        })}
                        className={`text-xs px-3 py-1 rounded font-medium ${
                          user.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {allUsersData && (
            <div className="mt-4 text-sm text-gray-500">
              Showing {allUsersData.users.length} of {allUsersData.total} users
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'cyan' | 'emerald'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    cyan: 'bg-cyan-50 border-cyan-200',
    emerald: 'bg-emerald-50 border-emerald-200',
  }

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}
