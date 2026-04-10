import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getCostItems, upsertCostItem, deleteCostItem } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Select, Badge, CategoryBadge, EmptyState, PageHeader, SearchInput, Toggle } from '../components/ui'

const CATEGORIES = ['LANDED', 'ORIGINATION', 'HIT']
const CATEGORY_COLORS = { LANDED: 'blue', ORIGINATION: 'amber', HIT: 'emerald' }

const empty = { name: '', unit: '', category: 'LANDED', value_per_unit: '', active: true }

export default function CostsPage() {
  const { T, fmt } = useApp()
  const [items, setItems] = useState([])
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
    try { setItems(await getCostItems()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setModal(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ ...item, value_per_unit: String(item.value_per_unit) })
    setModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.unit || !form.category) return
    setSaving(true)
    try {
      await upsertCostItem({
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        unit: form.unit,
        category: form.category,
        value_per_unit: parseFloat(form.value_per_unit) || 0,
        active: form.active,
      })
      setModal(false)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch {
      setToast({ message: T('error'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteCostItem(id)
      setConfirm(null)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch {
      setToast({ message: T('error'), type: 'error' })
    }
  }

  const filtered = items.filter(i =>
    (filterCat === 'ALL' || i.category === filterCat) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title={T('cost_items')}
        action={<Btn onClick={openNew}><Plus size={15}/>{T('new_cost')}</Btn>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={T('search')} />
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {['ALL', ...CATEGORIES].map(cat => (
            <button key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterCat === cat ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {cat === 'ALL' ? 'Todos' : T(cat)}
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
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(item.value_per_unit)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${item.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <Pencil size={14}/>
                      </button>
                      <button onClick={() => setConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
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

      {/* Modal edición */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? T('edit_cost') : T('new_cost')} width="max-w-lg">
        <div className="space-y-4">
          <Input label={T('cost_name')} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label={T('unit')} value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} required />
            <Select label={T('category')} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{T(c)}</option>)}
            </Select>
          </div>
          <Input label={T('value_per_unit')} type="number" step="0.0001" min="0"
            value={form.value_per_unit}
            onChange={e => setForm(f => ({ ...f, value_per_unit: e.target.value }))} />
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

      <Confirm open={!!confirm}
        message={T('confirm_delete')}
        onConfirm={() => handleDelete(confirm)}
        onCancel={() => setConfirm(null)} />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
