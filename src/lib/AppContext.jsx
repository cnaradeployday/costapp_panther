import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getCurrentProfile, getInstanceConfig } from '../lib/supabase'
import { t as translate } from '../i18n'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const cfg = await getInstanceConfig()
        setConfig(cfg)
      } catch {}

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        const p = await getCurrentProfile()
        setProfile(p)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await getCurrentProfile()
        setProfile(p)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const lang = config?.language ?? 'es'
  const currency = config?.currency_symbol ?? '€'
  const T = (key) => translate(lang, key)

  const fmt = (n) => {
    const num = parseFloat(n) || 0
    return `${currency} ${num.toFixed(4)}`
  }

  const refreshConfig = async () => {
    const cfg = await getInstanceConfig()
    setConfig(cfg)
  }

  return (
    <AppContext.Provider value={{ user, profile, config, loading, lang, currency, T, fmt, refreshConfig }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
