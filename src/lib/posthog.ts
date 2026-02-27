type PostHogType = {
  init: (key: string, opts?: Record<string, unknown>) => void
  capture: (event: string, props?: Record<string, unknown>) => void
  identify: (id: string) => void
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load PostHog script'))
    document.head.appendChild(s)
  })
}

export async function initPostHog(): Promise<void> {
  const key = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined
  const host = (import.meta.env.VITE_POSTHOG_API_HOST as string | undefined) || 'https://app.posthog.com'

  if (!key || typeof window === 'undefined') return

  try {
    // Try to use bundled module if available; otherwise load from CDN
    let ph: PostHogType | undefined

    // @ts-ignore - dynamic import may not be available in runtime without installation
    if (typeof (await import.meta.resolve ? undefined : undefined) !== 'undefined') {
      // no-op; kept for type-aware environments
    }

    if ((window as any).posthog) {
      ph = (window as any).posthog as PostHogType
    } else {
      // Load PostHog from CDN (unpkg) as a fallback so no npm install is required
      const cdn = `${host.replace(/\/$/, '')}/static/array.js` // PostHog provides builds under /static/
      await loadScript(cdn)
      ph = (window as any).posthog as PostHogType | undefined
    }

    if (!ph) return

    ph.init(key, { api_host: host, autocapture: false })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('PostHog init failed', e)
  }
}
