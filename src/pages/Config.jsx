import { useState, useEffect } from 'react'
import { updateInstanceConfig } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Input, Select, Btn, Toast, PageHeader, Modal, Badge } from '../components/ui'
import { getUsers, updateUserRole } from '../lib/supabase'
import { Plus } from 'lucide-react'

// ── Config Page ───────────────────────────────────────────────
export function ConfigPage() {
  const { config, T, refreshConfig } = useApp()
  const [form, setForm] = useState({
    company_name: config?.company_name ?? '',
    currency_code: config?.currency_code ?? 'EUR',
    currency_symbol: config?.currency_symbol ?? '€',
    language: config?.language ?? 'es',
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const CURRENCIES = [
    { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', label: 'Pound (GBP)' },
    { code: 'ARS', symbol: '$', label: 'Peso argentino (ARS)' },
    { code: 'USD', symbol: 'US$', label: 'Dollar (USD)' },
  ]

  async function handleSave() {
    setSaving(true)
    try {
      await updateInstanceConfig(form)
      await refreshConfig()
      setToast({ message: T('saved'), type: 'success' })
    } catch {
      setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  function selectCurrency(code) {
    const c = CURRENCIES.find(x => x.code === code)
    setForm(f => ({ ...f, currency_code: c.code, currency_symbol: c.symbol }))
  }

  return (
    <div>
      <PageHeader title={T('config_title')} />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-lg space-y-5">
        <Input label={T('company_name')} value={form.company_name}
          onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">Currency</label>
          <div className="grid grid-cols-2 gap-2">
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => selectCurrency(c.code)}
                className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                  form.currency_code === c.code
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-slate-400'
                }`}>
                <span className="text-lg mr-2">{c.symbol}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">{T('language')}</label>
          <div className="flex gap-3">
            {[['es', 'Español'], ['en', 'English']].map(([code, label]) => (
              <button key={code} onClick={() => setForm(f => ({ ...f, language: code }))}
                className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.language === code
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-slate-400'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-2">
          <Btn onClick={handleSave} disabled={saving}>{saving ? T('loading') : T('save')}</Btn>
        </div>
      </div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Users Page ────────────────────────────────────────────────
export function UsersPage() {
  const { T } = useApp()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviting, setInviting] = useState(false)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try { setUsers(await getUsers()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setModal(false)
      setInviteEmail('')
      setInviteRole('user')
      setToast({ message: 'Invitation sent!', type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e.message || T('error'), type: 'error' })
    } finally { setInviting(false) }
  }

  async function handleRoleChange(userId, role) {
    try {
      await updateUserRole(userId, role)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  const roleColors = { superadmin: 'violet', admin: 'amber', user: 'gray' }

  return (
    <div>
      <PageHeader title={T('users_title')}
        action={
          <Btn onClick={() => setModal(true)}>
            <Plus size={15}/>Invite user
          </Btn>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-4 py-3">{T('role')}</th>
                <th className="px-4 py-3">Change role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-50 ${i === users.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3 text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={roleColors[u.role]}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <select value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Invite user" width="max-w-md">
        <div className="space-y-4">
          <Input label="Email" type="email" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="user@company.com" />
          <Select label="Role" value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </Select>
          <p className="text-xs text-gray-400">
            The user will receive an email to set their password and access the system.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setModal(false)}>{T('cancel')}</Btn>
          <Btn onClick={handleInvite} disabled={inviting || !inviteEmail}>
            {inviting ? 'Sending...' : 'Send invitation'}
          </Btn>
        </div>
      </Modal>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
