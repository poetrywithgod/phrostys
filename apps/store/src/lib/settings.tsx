import { createContext, useContext, type ReactNode } from 'react'
import { fetchSettings, type StoreSettings } from './api'
import { useAsync } from './useAsync'

type Value = { settings: StoreSettings | null; loading: boolean; failed: boolean }
const SettingsContext = createContext<Value>({ settings: null, loading: true, failed: false })

/** Loads the shop's delivery rules once for the whole site. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const state = useAsync(fetchSettings, 'settings')
  return (
    <SettingsContext.Provider value={{ settings: state.data, loading: state.loading, failed: state.error !== null }}>
      {children}
    </SettingsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext)
