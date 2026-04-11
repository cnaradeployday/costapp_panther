import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
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

  async function loadProfile(sessionUser) {
    try {
      let { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (!data && sessionUser.email) {
        const res = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', sessionUser.email)
          .maybeSingle()
        data = res.data

        if (data && data.id !== sessionUser.id) {
          await supabase
            .from('user_profiles')
            .update({ id: sessionUser.id })
            .eq('email', sessionUser.email)
          data.id = sessionUser.id
        }
      }

      setProfile(data)
    } catch (e) {
      console.error('loadProfile error:', e)
    }
  }

  useEffect(() => {
    // Timeout de seguridad — si algo falla, no quedarse cargando para siempre
    const timeout = setTimeout(() => setLoading(false), 5000)

    async function init() {
      try {
        await loadConfig()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user)
        }
      } catch (e) {
        console.error('init error:', e)
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    const handleUnload = () => { supabase.auth.signOut() }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleUnload)
    }
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
