import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ConfigMissingPage from './pages/ConfigMissingPage.tsx'
import { CartProvider } from './lib/cart.tsx'
import { CheckoutProvider } from './lib/checkout.tsx'
import { SettingsProvider } from './lib/settings.tsx'
import { isSupabaseConfigured } from './lib/supabase.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <SettingsProvider>
          <CartProvider>
            <CheckoutProvider>
              <App />
            </CheckoutProvider>
          </CartProvider>
        </SettingsProvider>
      </BrowserRouter>
    ) : (
      <ConfigMissingPage />
    )}
  </StrictMode>,
)
