import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { recoverFromStaleBundle } from './utils/staleBundleRecovery'
import './styles/global.css'

registerSW({ immediate: true })

window.addEventListener('vite:preloadError', (event) => {
  if (recoverFromStaleBundle(event.payload)) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
