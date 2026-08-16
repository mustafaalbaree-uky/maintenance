import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyMotionAttribute } from './lib/motion'
import { lockZoom } from './lib/lock-zoom'

applyMotionAttribute()
lockZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
