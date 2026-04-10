import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t as translate } from '../i18n'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadConfig() {
    try {
      const { data } = await supabase.from('instance_config').select('*').maybeSingle()
      if (data) setConfig(data)
    } catch {}
  }

  async function loadProfile(userId) {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data)
    } catch {}
  }

  useEffect(() => {
    async function init() {
      await loadConfig()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
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
  const fmt = (n) => `${currency} ${(parseFloat(n) || 0).toFixed(4)}`
  const refreshConfig = async () => await loadConfig()

  return (
    <AppContext.Provider value={{ user, profile, config, loading, lang, currency, T, fmt, refreshConfig }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}