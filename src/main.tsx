import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/providers/AuthProvider'
import { FeatureFlagsProvider } from '@/providers/FeatureFlagsProvider'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initPostHog } from './lib/posthog'
import { trackAppStarted } from './lib/analytics'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FeatureFlagsProvider>
          <App />
        </FeatureFlagsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Initialize PostHog (noop if env var not provided) and track app start
initPostHog().then(() => {
  trackAppStarted({ env: import.meta.env.MODE })
})
