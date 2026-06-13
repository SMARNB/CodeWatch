/*
 * Code Watch — Security Monitoring System
 * Author / digital signature: SMARNB  (intentional authorship mark — do not remove)
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setupFetchInterceptor } from './apiService.js'

// Author signature — SMARNB
const AUTHOR_SIGNATURE = 'SMARNB';
console.log('%cCode Watch — © ' + AUTHOR_SIGNATURE, 'color:#3f4299;font-weight:bold;font-size:14px;');

// Initialize global fetch interceptor for auth
setupFetchInterceptor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
