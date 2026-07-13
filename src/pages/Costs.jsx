import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getCostItems, upsertCostItem, deleteCostItem, getPrintTechniques, getLabourRates } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { costType, effectiveRate } from '../lib/techniqueCosts'
import { Modal, Confirm, Toast, Btn, Input, Select, Badge, CategoryBadge, EmptyState, PageHeader, SearchInput, Toggle } from '../components/ui'

const CATEGORIES = ['LANDED', 'ORIGINATION', 'HIT', 'QC_PRINT']
const empty = { name: '', unit: '', category: 'LANDED', value_per_unit: '', value_type: 'nominal', active: true, technique_ids: [], labour_rate_id: '' }

export default function CostsPage() {
  const { T, fmt, tabVisible } = useApp()
  const [items, setItems] = useState([])
  const [units, setUnits] = useState([])
  const [techniques, setTechniques] = useState([])
  const [labourRates, setLabourRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('ALL')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [costs, uoms, techs, labour] = await Promise.all([
        getCostItems(),
        supabase.from('units_of_measure').select('*').order('name').then(r => r.data ?? []),
        getPrintTechniques(),
        getLabourRates()
      ])
      setItems(costs)
      setUnits(uoms)
      setTechniques(techs)
      setLabourRates(labour.filter(r => r.active))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm({ ...empty, technique_ids: techniques.map(t => t.id) }); setModal(true) }
  function openEdit(item) {
    setEditing(item)
    setForm({
      ...item,
      value_per_unit: String(item.value_per_unit),
      technique_ids: item.technique_ids ?? [],
      labour_rate_id: item.labour_rate_id ?? '',
    })
    setModal(true)
  }

  function toggleTechnique(id) {
    setForm(f => ({
      ...f,
      technique_ids: f.technique_ids.includes(id)
        ? f.technique_ids.filter(x => x !== id)
        : [...f.technique_ids, id]
    }))
  }

  function toggleAllTechniques() {
    setForm(f => ({
      ...f,
      technique_ids: f.technique_ids.length === techniques.length ? [] : techniques.map(t => t.id)
    }))
  }

  async function handleSave() {
    if (!form.name || !form.unit || !form.category) return
    setSaving(true)
    try {
      const linkedRate = labourRates.find(r => r.id === form.labour_rate_id)
      const value_per_unit = linkedRate
        ? parseFloat(linkedRate.cost_per_hour) / 60
        : parseFloat(form.value_per_unit) || 0
      await upsertCostItem({
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        unit: form.unit,
        category: form.category,
        value_per_unit,
        value_type: form.value_type ?? 'nominal',
        active: form.active,
        technique_ids: form.technique_ids,
        labour_rate_id: form.labour_rate_id || null,
      })
      setModal(false)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteCostItem(id); setConfirm(null)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  const filtered = items.filter(i =>
    (filterCat === 'ALL' || i.category === filterCat) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedUnit = units.find(u => u.name === form.unit)
  const isPct = selectedUnit?.type === 'percentage' || form.value_type === 'percentage_of_fob'

  return (
    <div>
      <PageHeader title={T('cost_items')}
        action={<Btn onClick={openNew}><Plus size={15}/>{T('new_cost')}</Btn>} />

      <div className="flex gap-3 mb-5 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={T('search')} />
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {['ALL', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterCat === cat ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {cat === 'ALL' ? 'All' : T(cat)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>
      ) : filtered.length === 0 ? (
        <EmptyState message={T('noResults')} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <th className="text-left px-5 py-3">{T('name')}</th>
                <th className="text-left px-4 py-3">{T('unit')}</th>
                <th className="text-left px-4 py-3">{T('category')}</th>
                <th className="text-left px-4 py-3">Cost type</th>
                <th className="text-left px-4 py-3">Techniques</th>
                <th className="text-right px-4 py-3">{T('value_per_unit')}</th>
                <th className="text-center px-4 py-3">{T('active')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3"><CategoryBadge category={item.category} /></td>
                  <td className="px-4 py-3">
                    {item.category === 'LANDED'
                      ? <span className="text-xs text-gray-300">—</span>
                      : <Badge color={costType(item.category) === 'FIX' ? 'amber' : 'emerald'}>{costType(item.category)}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {!item.technique_ids?.length
                      ? 'All'
                      : techniques.filter(t => item.technique_ids.includes(t.id)).map(t => t.name).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {item.value_type === 'percentage_of_fob'
                      ? <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg">{item.value_per_unit}% of FOB</span>
                      : item.labour_rates
                        ? <span title={`From labour rate: ${item.labour_rates.skill} / ${item.labour_rates.experience_level}`}>{fmt(effectiveRate(item))}*</span>
                        : fmt(item.value_per_unit)
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${item.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil size={14}/>
                      </button>
                      <button onClick={() => setConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? T('edit_cost') : T('new_cost')} width="max-w-lg">
        <div className="space-y-4">
          <Input label={T('cost_name')} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{T('unit')}</label>
              <select value={form.unit}
                onChange={e => {
                  const u = units.find(x => x.name === e.target.value)
                  setForm(f => ({
                    ...f,
                    unit: e.target.value,
                    value_type: u?.type === 'percentage' ? 'percentage_of_fob' : 'nominal'
                  }))
                }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="">— select unit —</option>
                {units.map(u => (
                  <option key={u.id} value={u.name}>
                    {u.name} {u.type === 'percentage' ? '(% of FOB)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Select label={T('category')} value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{T(c)}</option>)}
              </Select>
              {form.category !== 'LANDED' && (
                <span className="text-xs text-gray-400">
                  Cost type: <span className="font-medium text-gray-600">{costType(form.category)}</span>
                </span>
              )}
            </div>
          </div>

          {!isPct && form.category !== 'LANDED' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Link to labour rate (optional)</label>
              <select value={form.labour_rate_id}
                onChange={e => setForm(f => ({ ...f, labour_rate_id: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="">— none, use manual value below —</option>
                {labourRates.map(r => (
                  <option key={r.id} value={r.id}>{r.skill} · {r.experience_level} ({fmt(r.cost_per_hour)}/h)</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">
                When linked, the cost/unit is always (labour €/hour ÷ 60) and updates automatically if the labour rate changes.
              </p>
            </div>
          )}

          <Input
            label={isPct ? 'Rate (% of FOB)' : T('value_per_unit')}
            type="number" step="0.0001" min="0"
            value={form.labour_rate_id
              ? ((labourRates.find(r => r.id === form.labour_rate_id)?.cost_per_hour || 0) / 60).toFixed(4)
              : form.value_per_unit}
            onChange={e => setForm(f => ({ ...f, value_per_unit: e.target.value }))}
            disabled={!!form.labour_rate_id}
          />
          {isPct && (
            <p className="text-xs text-gray-400">
              Example: enter 12 for 12% of FOB. For a product with FOB €2.50 → cost = €0.30
            </p>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Applicable techniques</label>
              {techniques.length > 0 && (
                <button type="button" onClick={toggleAllTechniques}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900">
                  {form.technique_ids.length === techniques.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 -mt-0.5 mb-1">Leave empty to make this cost available for all techniques.</p>
            <div className="flex flex-wrap gap-2 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {techniques.length === 0 ? (
                <span className="text-xs text-gray-400">No techniques yet</span>
              ) : techniques.map(t => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={form.technique_ids.includes(t.id)}
                    onChange={() => toggleTechnique(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Toggle checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm text-gray-600">{T('active')}</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setModal(false)}>{T('cancel')}</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? T('loading') : T('save')}</Btn>
        </div>
      </Modal>

      <Confirm open={!!confirm} message={T('confirm_delete')}
        onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
