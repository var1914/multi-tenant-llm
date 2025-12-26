import { useRealtimeStats } from '../../hooks/useRealtime'
import clsx from 'clsx'

export default function RealtimeStatsBar() {
  const { stats, isConnected } = useRealtimeStats({ statsInterval: 5 })

  if (!stats) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Real-Time Stats</h3>
          <div className="flex items-center gap-1">
            <div
              className={clsx(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              )}
            />
            <span className="text-xs text-white/70">
              {isConnected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>
        <span className="text-xs text-white/70">
          Updated: {new Date(stats.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatItem
          label="Requests Today"
          value={stats.total_requests_today.toLocaleString()}
        />
        <StatItem
          label="Tokens Today"
          value={formatNumber(stats.total_tokens_today)}
        />
        <StatItem
          label="Cost Today"
          value={`$${stats.total_cost_today.toFixed(2)}`}
        />
        <StatItem
          label="Active Customers"
          value={stats.active_customers_today.toString()}
        />
        <StatItem
          label="Requests/min"
          value={stats.requests_per_minute.toFixed(1)}
        />
        <StatItem
          label="Routing Rate"
          value={`${stats.routing_rate.toFixed(1)}%`}
          highlight={stats.routing_rate > 0}
        />
        <StatItem
          label="Savings Today"
          value={`$${stats.estimated_savings_today.toFixed(2)}`}
          highlight={stats.estimated_savings_today > 0}
        />
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-white/70">{label}</div>
      <div
        className={clsx(
          'text-lg font-bold',
          highlight ? 'text-green-300' : 'text-white'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}
