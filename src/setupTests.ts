// Vitest/Jest-like setup for browser environment
// Polyfill ResizeObserver used by carousel/DashboardPage in tests
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = (global as any).ResizeObserver || ResizeObserver

// Optional: polyfill window.matchMedia if needed by components
if (typeof window !== 'undefined' && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
