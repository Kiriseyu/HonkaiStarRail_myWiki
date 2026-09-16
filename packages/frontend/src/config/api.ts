// API Configuration
const isDevelopment = import.meta.env.DEV

// Development API URL (can be overridden by VITE_API_URL env var)
const DEV_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Production API URL (can be overridden by VITE_API_URL env var)
// Site is static JSON for now; set VITE_API_URL when a real API exists
const PROD_API_URL = import.meta.env.VITE_API_URL || 'https://honkaistarrail-mywiki.pages.dev'

export const API_BASE_URL = isDevelopment ? DEV_API_URL : PROD_API_URL

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
}
