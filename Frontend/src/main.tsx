import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/i18n'
import { reportWebVitals } from './lib/webVitals'
import * as Sentry from '@sentry/react'

const getApiOrigin = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl && envUrl.trim() !== "") {
    return envUrl
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const hostname = window.location.hostname
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:8000/api/v1`
    }
    return "https://api.courssat.online/api/v1"
  }
  return "http://127.0.0.1:8000/api/v1"
}

const apiUrl = getApiOrigin()

if (apiUrl && typeof document !== "undefined") {
  try {
    const origin = new URL(apiUrl).origin
    if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
      const link = document.createElement("link")
      link.rel = "preconnect"
      link.href = origin
      document.head.appendChild(link)
    }
  } catch {
    /* ignore invalid URL format */
  }
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn && sentryDsn.trim() !== '') {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.5 : 0,
    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address
        delete event.user.email
      }
      return event
    },
  })
}

createRoot(document.getElementById("root")!).render(<App />)

reportWebVitals()
