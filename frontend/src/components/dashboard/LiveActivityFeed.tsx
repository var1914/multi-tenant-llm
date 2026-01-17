import { useState } from 'react'
import { useRealtimeEvents, useRealtimeRouting } from '../../hooks/useRealtime'
import clsx from 'clsx'

type TabType = 'usage' | 'routing'

export default function LiveActivityFeed() {
  const [activeTab, setActiveTab] = useState<TabType>('usage')
  const { events: usageEvents, isConnected: usageConnected } = useRealtimeEvents({ enabled: activeTab === 'usage' })
  const { routingEvents, isConnected: routingConnected } = useRealtimeRouting({ enabled: activeTab === 'routing' })

  const isConnected = activeTab === 'usage' ? usageConnected : routingConnected

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Live Activity</h2>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'h-2 w-2 rounded-full',
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                )}
              />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('usage')}
              className={clsx(
                'px-3 py-1 text-sm rounded-md transition-colors',
                activeTab === 'usage'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Usage Events
            </button>
            <button
              onClick={() => setActiveTab('routing')}
              className={clsx(
                'px-3 py-1 text-sm rounded-md transition-colors',
                activeTab === 'routing'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Routing
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-h-96 overflow-y-auto">
        {activeTab === 'usage' ? (
          <UsageEventsList events={usageEvents} />
        ) : (
          <RoutingEventsList events={routingEvents} />
        )}
      </div>
    </div>
  )
}

function UsageEventsList({ events }: { events: Array<{
  id: string
  timestamp: string
  customer_id: string
  customer_name?: string
  model: string
  tokens: number
  cost_usd: number
}> }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <p>Waiting for usage events...</p>
        <p className="text-sm mt-1">Events will appear here in real-time</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 text-xs font-medium">
                {event.customer_id.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-medium text-sm">
                {event.customer_name || event.customer_id}
              </div>
              <div className="text-xs text-gray-500">
                {event.model} - {event.tokens.toLocaleString()} tokens
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium text-sm">${event.cost_usd.toFixed(4)}</div>
            <div className="text-xs text-gray-500">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RoutingEventsList({ events }: { events: Array<{
  id: string
  timestamp: string
  original_model: string
  routed_model: string
  routing_applied: boolean
  estimated_savings_usd: number
}> }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        <p>Waiting for routing decisions...</p>
        <p className="text-sm mt-1">Enable smart routing to see activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className={clsx(
            'flex items-center justify-between p-3 rounded-lg animate-fadeIn',
            event.routing_applied ? 'bg-green-50' : 'bg-gray-50'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={clsx(
              'h-8 w-8 rounded-full flex items-center justify-center',
              event.routing_applied ? 'bg-green-100' : 'bg-gray-100'
            )}>
              {event.routing_applied ? (
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              )}
            </div>
            <div>
              <div className="font-medium text-sm">
                {event.original_model}
                {event.routing_applied && (
                  <>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="text-green-600">{event.routed_model}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {event.routing_applied ? 'Routed to cheaper model' : 'Using original model'}
              </div>
            </div>
          </div>
          <div className="text-right">
            {event.routing_applied && (
              <div className="font-medium text-sm text-green-600">
                +${event.estimated_savings_usd.toFixed(4)}
              </div>
            )}
            <div className="text-xs text-gray-500">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
