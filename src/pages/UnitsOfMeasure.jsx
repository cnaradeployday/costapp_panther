import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Btn, Input, Toast, PageHeader, Confirm } from '../components/ui'

async function getUnits() {
  const { data, error } = await supabase.from('units_of_measure').select('*').order('name')
  if (error) throw error
  return data
}
async function upsertUnit(u) {
  const { data, error } = await supabase.from('units_of_measure').upsert(u).select().single()
  if (error) throw error
  return data
}
async function deleteUnit(id) {
  const { error } = await supabase.from('units_of_measure').delete().eq('id', id)
  if (error) throw error
}

export default function UnitsPage() {
  const { tabVisible } = useApp()
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', type: 'nominal' })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try { setUnits(await getUnits()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await upsertUnit({ name: form.name.trim(), type: form.type })
      setForm({ name: '', type: 'nominal' })
      setToast({ message: 'Saved', type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e.message?.includes('unique') ? 'Unit already exists' : 'Error', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteUnit(id)
      setConfirm(null)
      await load()
    } catch {
      setToast({ message: 'Cannot delete — in use by a cost item', type: 'error' })
      setConfirm(null)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>

  return (
    <div>
      <PageHeader title="Units of measure" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
            {units.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No units defined</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Name</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.id} className={`border-b border-gray-50 ${i === units.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3">
                        {u.type === 'percentage'
                          ? <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg font-medium">% of FOB</span>
                          : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-medium">Nominal</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setConfirm(u.id)}
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

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Add unit</p>
            <div className="flex gap-3 items-end">
              <Input label="Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. litres" className="flex-1" />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option value="nominal">Nominal</option>
                  <option value="percentage">% of FOB</option>
                </select>
              </div>
              <Btn size="sm" onClick={handleAdd} disabled={saving}>
                <Plus size={13}/>{saving ? 'Saving...' : 'Add'}
              </Btn>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              <strong>Nominal:</strong> fixed value per unit (€/watt, €/ml, €/minute).<br/>
              <strong>% of FOB:</strong> cost calculated as a percentage of the product's FOB price.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">How it works</h3>
          <div className="space-y-4 text-xs text-gray-500">
            <div className="flex gap-3">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-medium shrink-0 h-fit">Nominal</span>
              <div>
                <p className="font-medium text-gray-700 mb-1">Fixed cost per unit</p>
                <p>Energy @ €0.002/watt. Machine uses 500 watts → cost = €1.00</p>
                <p className="mt-1">Freight @ €0 global (set per product). Assigned to product at €0.45/unit → cost = €0.45</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg font-medium shrink-0 h-fit">% of FOB</span>
              <div>
                <p className="font-medium text-gray-700 mb-1">Percentage of product FOB</p>
                <p>Import duties @ 12%. Product FOB = €2.50 → cost = €0.30</p>
                <p className="mt-1">The % can be overridden per product if the rate differs.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Confirm open={!!confirm} message="Delete this unit?"
        onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
