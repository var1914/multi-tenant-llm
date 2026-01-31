/** Lightweight page view tracking using sendBeacon. */
export function trackPageView(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const data = JSON.stringify({
      page_path: window.location.pathname,
      referrer: document.referrer || undefined,
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
    })
    navigator.sendBeacon(
      '/api/v1/track/pageview',
      new Blob([data], { type: 'application/json' }),
    )
  } catch {
    // Tracking should never break the app
  }
}
