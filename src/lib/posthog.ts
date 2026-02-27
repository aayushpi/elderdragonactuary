import posthog from 'posthog-js'

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined
  const host = (import.meta.env.VITE_POSTHOG_API_HOST as string | undefined) || 'https://app.posthog.com'

  if (!key) return

  try {
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      loaded: () => {
        // optional: identify anonymous user with stored id
      },
    })
  } catch (e) {
    // silent fail in case PostHog lib isn't available in some environments
    // eslint-disable-next-line no-console
    console.warn('PostHog init failed', e)
  }
}
