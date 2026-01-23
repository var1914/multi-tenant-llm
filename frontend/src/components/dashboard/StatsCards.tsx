import React from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface UsageSummary {
  total_quantity: number
  total_cost_usd: string
  event_count: number
}

export default function StatsCards() {
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get('/customers')
      return response.data
    },
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await apiClient.get('/api-keys')
      return response.data
    },
  })

  const { data: usageSummary } = useQuery<UsageSummary>({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const response = await apiClient.get('/usage/dashboard/summary')
      return response.data
    },
  })

  const totalCustomers = customers?.length || 0
  const totalTokens = usageSummary?.total_quantity || 0
  const totalCost = parseFloat(usageSummary?.total_cost_usd || '0')
  const activeKeys = apiKeys?.filter((k: { is_active: boolean }) => k.is_active).length || 0

  const stats: Array<{
    name: string
    value: string | number
    icon: React.ComponentType<{ className?: string }>
    color: string
    trend: string | null
  }> = [
    {
      name: 'Total Customers',
      value: totalCustomers,
      icon: CustomersIcon,
      color: 'blue',
      trend: null, // No historical data to compare yet
    },
    {
      name: 'Total Tokens',
      value: totalTokens.toLocaleString(),
      icon: UsageIcon,
      color: 'success',
      trend: null, // No historical data to compare yet
    },
    {
      name: 'Total Cost',
      value: `$${totalCost.toFixed(2)}`,
      icon: CostIcon,
      color: 'warning',
      trend: null, // No historical data to compare yet
    },
    {
      name: 'Active API Keys',
      value: activeKeys,
      icon: KeyIcon,
      color: 'purple',
      trend: null,
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-vscode-blue',
    success: 'bg-vscode-success',
    warning: 'bg-vscode-warning',
    purple: 'bg-vscode-purple',
  }

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    purple: 'text-purple-600',
  }

  const iconBgMap: Record<string, string> = {
    blue: 'bg-blue-100',
    success: 'bg-green-100',
    warning: 'bg-amber-100',
    purple: 'bg-purple-100',
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white rounded-xl p-6 relative overflow-hidden group shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          {/* Left accent bar */}
          <div className={`absolute top-0 left-0 w-1 h-full ${colorMap[stat.color]} transition-all group-hover:w-1.5`} />

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-2.5 rounded-xl ${iconBgMap[stat.color]}`}>
                <stat.icon className={`h-6 w-6 ${iconColorMap[stat.color]}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            {stat.trend && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.trend.startsWith('+') ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                {stat.trend}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CustomersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}

function UsageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function CostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
