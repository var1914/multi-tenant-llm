import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'

interface RealtimeStats {
  timestamp: string
  total_requests_today: number
  total_tokens_today: number
  total_cost_today: number
  active_customers_today: number
  requests_per_minute: number
  routing_rate: number
  estimated_savings_today: number
}

interface UsageEvent {
  id: string
  timestamp: string
  customer_id: string
  customer_name?: string
  model: string
  provider?: string
  tokens: number
  cost_usd: number
  event_type?: string
}

interface RoutingEvent {
  id: string
  timestamp: string
  original_model: string
  routed_model: string
  routing_applied: boolean
  complexity_score?: number
  routing_reason?: string
  estimated_savings_usd: number
}

interface UseRealtimeOptions {
  enabled?: boolean
  statsInterval?: number
  eventsInterval?: number
}

export function useRealtimeStats(options: UseRealtimeOptions = {}) {
  const { enabled = true, statsInterval = 5 } = options
  const [stats, setStats] = useState<RealtimeStats | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (!enabled || !token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const url = `${apiUrl}/api/v1/realtime/stats?interval=${statsInterval}&token=${encodeURIComponent(token)}`

    const eventSource = new EventSource(url)

    eventSource.addEventListener('stats', (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeStats
        setStats(data)
        setError(null)
      } catch (e) {
        console.error('Failed to parse stats event:', e)
      }
    })

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        setError(data.error)
      } catch {
        setError('Connection error')
      }
    })

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close()
          connect()
        }
      }, 5000)
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled, token, statsInterval])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  return { stats, isConnected, error }
}

export function useRealtimeEvents(options: UseRealtimeOptions = {}) {
  const { enabled = true, eventsInterval = 2 } = options
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (!enabled || !token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const url = `${apiUrl}/api/v1/realtime/events?interval=${eventsInterval}&token=${encodeURIComponent(token)}`

    const eventSource = new EventSource(url)

    eventSource.addEventListener('usage', (event) => {
      try {
        const data = JSON.parse(event.data) as UsageEvent
        setEvents((prev) => {
          const newEvents = [data, ...prev].slice(0, 50) // Keep last 50 events
          return newEvents
        })
      } catch (e) {
        console.error('Failed to parse usage event:', e)
      }
    })

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => {
      setIsConnected(false)
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close()
          connect()
        }
      }, 5000)
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled, token, eventsInterval])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, isConnected, clearEvents }
}

export function useRealtimeRouting(options: UseRealtimeOptions = {}) {
  const { enabled = true, eventsInterval = 2 } = options
  const [routingEvents, setRoutingEvents] = useState<RoutingEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (!enabled || !token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const url = `${apiUrl}/api/v1/realtime/routing?interval=${eventsInterval}&token=${encodeURIComponent(token)}`

    const eventSource = new EventSource(url)

    eventSource.addEventListener('routing', (event) => {
      try {
        const data = JSON.parse(event.data) as RoutingEvent
        setRoutingEvents((prev) => {
          const newEvents = [data, ...prev].slice(0, 50)
          return newEvents
        })
      } catch (e) {
        console.error('Failed to parse routing event:', e)
      }
    })

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => {
      setIsConnected(false)
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close()
          connect()
        }
      }, 5000)
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled, token, eventsInterval])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  const clearEvents = useCallback(() => setRoutingEvents([]), [])

  return { routingEvents, isConnected, clearEvents }
}

// Combined hook for all realtime data
export function useRealtimeCombined(options: UseRealtimeOptions = {}) {
  const { enabled = true, statsInterval = 5, eventsInterval = 2 } = options
  const [stats, setStats] = useState<RealtimeStats | null>(null)
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([])
  const [routingEvents, setRoutingEvents] = useState<RoutingEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (!enabled || !token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const url = `${apiUrl}/api/v1/realtime/combined?stats_interval=${statsInterval}&events_interval=${eventsInterval}&token=${encodeURIComponent(token)}`

    const eventSource = new EventSource(url)

    eventSource.addEventListener('stats', (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeStats
        setStats(data)
      } catch (e) {
        console.error('Failed to parse stats:', e)
      }
    })

    eventSource.addEventListener('usage', (event) => {
      try {
        const data = JSON.parse(event.data) as UsageEvent
        setUsageEvents((prev) => [data, ...prev].slice(0, 50))
      } catch (e) {
        console.error('Failed to parse usage event:', e)
      }
    })

    eventSource.addEventListener('routing', (event) => {
      try {
        const data = JSON.parse(event.data) as RoutingEvent
        setRoutingEvents((prev) => [data, ...prev].slice(0, 50))
      } catch (e) {
        console.error('Failed to parse routing event:', e)
      }
    })

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => {
      setIsConnected(false)
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close()
          connect()
        }
      }, 5000)
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled, token, statsInterval, eventsInterval])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  return { stats, usageEvents, routingEvents, isConnected }
}
