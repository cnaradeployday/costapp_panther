import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Btn, Input } from '../components/ui'
import logo from '../assets/logopanther.jpg'

export default function Login() {
  const { config, T } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch {
      setError(T('loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-sm" />
          <h1 className="text-2xl font-semibold text-gray-900">{config?.company_name}</h1>
          <p className="text-sm text-gray-400 mt-1">{config?.currency_code} · Cost system</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={T('email')} type="email" value={email}
            onChange={e => setEmail(e.target.value)} required autoFocus />
          <Input label={T('password')} type="password" value={password}
            onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <Btn type="submit" disabled={loading} className="w-full justify-center">
            {loading ? T('loading') : T('login')}
          </Btn>
        </form>
      </div>
    </div>
  )
}
