import { useEffect, useState } from 'react'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { getExchangeRates, upsertExchangeRate, deleteExchangeRate } from '../lib/landed'
import { useApp } from '../lib/AppContext'
import { Confirm, Toast, Btn, Input, PageHeader } from '../components/ui'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'STG', 'CNY']
const empty = { currency_from: 'USD', currency_to: 'EUR', rate: '', valid_from: new Date().toISOString().split('T')[0], valid_to: '', notes: '' }

export default function ExchangeRatesPage() {
  const { tabVisible } = useApp()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try { setRates(await getExchangeRates()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  async function handleAdd() {
    if (!form.rate || !form.currency_from || !form.currency_to || !form.valid_from) return
    setSaving(true)
    try {
      await upsertExchangeRate({ ...form, rate: parseFloat(form.rate) })
      setForm(empty)
      setToast({ message: 'Rate saved', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error saving', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteExchangeRate(id); setConfirm(null)
      setToast({ message: 'Deleted', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  // Agrupar por par de monedas
  const grouped = rates.reduce((acc, r) => {
    const key = `${r.currency_from}→${r.currency_to}`
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div>
      <PageHeader title="Exchange Rates" />

      {/* Formulario de nueva tasa */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Add new rate</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">From</label>
            <select value={form.currency_from} onChange={e => setForm(f => ({ ...f, currency_from: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 w-24">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">To</label>
            <select value={form.currency_to} onChange={e => setForm(f => ({ ...f, currency_to: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 w-24">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <Input label="Rate" type="number" step="0.000001" min="0" value={form.rate}
            onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} className="w-32" />
          <Input label="Valid from" type="date" value={form.valid_from}
            onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="w-36" />
          <Input label="Valid to (blank = current)" type="date" value={form.valid_to}
            onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="w-40" />
          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="flex-1 min-w-40" />
          <Btn onClick={handleAdd} disabled={saving}><Plus size={14}/>{saving ? 'Saving...' : 'Add'}</Btn>
        </div>
      </div>

      {/* Tabla de tasas agrupadas */}
      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([pair, pairRates]) => (
            <div key={pair} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                <TrendingUp size={14} className="text-gray-400"/>
                <span className="text-sm font-semibold text-gray-900">{pair}</span>
                <span className="text-xs text-gray-400 ml-1">{pairRates.length} rate{pairRates.length > 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 font-medium uppercase tracking-wider border-b border-gray-50">
                    <th className="text-right px-5 py-2">Rate</th>
                    <th className="text-left px-4 py-2">Valid from</th>
                    <th className="text-left px-4 py-2">Valid to</th>
                    <th className="text-left px-4 py-2">Notes</th>
                    <th className="text-center px-4 py-2">Status</th>
                    <th className="px-4 py-2"/>
                  </tr>
                </thead>
                <tbody>
                  {pairRates.map((r, i) => {
                    const today = new Date().toISOString().split('T')[0]
                    const active = r.valid_from <= today && (!r.valid_to || r.valid_to >= today)
                    return (
                      <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i === pairRates.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-5 py-2.5 text-right font-mono font-semibold text-gray-900">{parseFloat(r.rate).toFixed(6)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.valid_from}</td>
                        <td className="px-4 py-2.5 text-gray-400">{r.valid_to || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{r.notes || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            {active ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setConfirm(r.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Confirm open={!!confirm} message="Delete this rate?" onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
