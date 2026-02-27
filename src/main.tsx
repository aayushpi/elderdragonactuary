import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/providers/AuthProvider'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initPostHog } from './lib/posthog'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Initialize PostHog (noop if env var not provided)
initPostHog()
