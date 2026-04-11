import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  getMarginTiers, upsertMarginTier, deleteMarginTier,
  getQtyBreaks, upsertQtyBreak, deleteQtyBreak
} from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Btn, Input, Toast, PageHeader, Confirm } from '../components/ui'

export default function MarginsPage() {
  const { fmt } = useApp()
  const [tiers, setTiers] = useState([])
  const [breaks, setBreaks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // Forms
  const [tierForm, setTierForm] = useState({ qty_from: '', qty_to: '', margin_pct: '' })
  const [breakForm, setBreakForm] = useState({ quantity: '' })
  const [savingTier, setSavingTier] = useState(false)
  const [savingBreak, setSavingBreak] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [t, b] = await Promise.all([getMarginTiers(), getQtyBreaks()])
      setTiers(t)
      setBreaks(b)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleAddTier() {
    if (!tierForm.qty_from || !tierForm.margin_pct) return
    setSavingTier(true)
    try {
      await upsertMarginTier({
        qty_from: parseInt(tierForm.qty_from),
        qty_to: tierForm.qty_to ? parseInt(tierForm.qty_to) : null,
        margin_pct: parseFloat(tierForm.margin_pct),
      })
      setTierForm({ qty_from: '', qty_to: '', margin_pct: '' })
      setToast({ message: 'Saved', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error', type: 'error' })
    } finally { setSavingTier(false) }
  }

  async function handleDeleteTier(id) {
    try {
      await deleteMarginTier(id)
      setConfirm(null)
      await load()
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  async function handleAddBreak() {
    const qty = parseInt(breakForm.quantity)
    if (!qty || qty <= 0) return
    setSavingBreak(true)
    try {
      await upsertQtyBreak({
        quantity: qty,
        is_default: true,
        sort_order: breaks.length + 1
      })
      setBreakForm({ quantity: '' })
      setToast({ message: 'Saved', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error', type: 'error' })
    } finally { setSavingBreak(false) }
  }

  async function handleDeleteBreak(id) {
    try {
      await deleteQtyBreak(id)
      setConfirm(null)
      await load()
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>

  return (
    <div>
      <PageHeader title="Margins & Qty breaks" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Margin tiers */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Margin tiers</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
            {tiers.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No tiers configured</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                    <th className="text-left px-4 py-3">From</th>
                    <th className="text-left px-4 py-3">To</th>
                    <th className="text-right px-4 py-3">Margin</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t, i) => (
                    <tr key={t.id} className={`border-b border-gray-50 ${i === tiers.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3 text-gray-700">{t.qty_from.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700">{t.qty_to ? t.qty_to.toLocaleString() : '∞'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-lg">{t.margin_pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setConfirm({ type: 'tier', id: t.id })}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400">
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add tier form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Add tier</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Input label="From qty" type="number" min="0" placeholder="1"
                value={tierForm.qty_from}
                onChange={e => setTierForm(f => ({ ...f, qty_from: e.target.value }))} />
              <Input label="To qty" type="number" min="0" placeholder="∞ (leave empty)"
                value={tierForm.qty_to}
                onChange={e => setTierForm(f => ({ ...f, qty_to: e.target.value }))} />
              <Input label="Margin %" type="number" min="0" max="100" step="0.1" placeholder="30"
                value={tierForm.margin_pct}
                onChange={e => setTierForm(f => ({ ...f, margin_pct: e.target.value }))} />
            </div>
            <Btn size="sm" onClick={handleAddTier} disabled={savingTier}>
              <Plus size={13}/>{savingTier ? 'Saving...' : 'Add tier'}
            </Btn>
          </div>
        </div>

        {/* Qty breaks */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Default qty breaks</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
            {breaks.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No breaks configured</p>
            ) : (
              <div className="flex flex-wrap gap-2 p-4">
                {breaks.map(b => (
                  <span key={b.id} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-xl">
                    {b.quantity.toLocaleString()} units
                    <button onClick={() => setConfirm({ type: 'break', id: b.id })}
                      className="text-slate-400 hover:text-red-400 transition-colors">
                      <X size={12}/>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add break form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Add break</p>
            <div className="flex gap-2 items-end">
              <Input label="Quantity" type="number" min="1" placeholder="e.g. 2500"
                value={breakForm.quantity}
                onChange={e => setBreakForm({ quantity: e.target.value })}
                className="flex-1" />
              <Btn size="sm" onClick={handleAddBreak} disabled={savingBreak}>
                <Plus size={13}/>{savingBreak ? 'Saving...' : 'Add'}
              </Btn>
            </div>
          </div>
        </div>
      </div>

      <Confirm
        open={!!confirm}
        message="Delete this item?"
        onConfirm={() => confirm?.type === 'tier' ? handleDeleteTier(confirm.id) : handleDeleteBreak(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
