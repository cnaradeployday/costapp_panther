import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getPrintTechniques, upsertPrintTechnique, deletePrintTechnique,
  getCostItems, upsertTechniqueCost, deleteTechniqueCost
} from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import {
  Modal, Confirm, Toast, Btn, Input, Select,
  CategoryBadge, EmptyState, PageHeader, SearchInput, Toggle
} from '../components/ui'

const PRESETS = ['pad_printing', 'screen_printing', 'embroidery', 'laser', 'dtf', 'sublimation', 'uv_printing', 'other']
const empty = { name: '', base_preset: '', active: true }

export default function TechniquesPage() {
  const { T, fmt } = useApp()
  const [techniques, setTechniques] = useState([])
  const [allCosts, setAllCosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmTc, setConfirmTc] = useState(null)
  const [toast, setToast] = useState(null)
  const [tcForm, setTcForm] = useState({ cost_item_id: '', quantity: '1', category: 'ORIGINATION' })
  const [addingTc, setAddingTc] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [tech, costs] = await Promise.all([getPrintTechniques(), getCostItems()])
      setTechniques(tech)
      setAllCosts(costs.filter(c => c.category !== 'LANDED' && c.active))
    } catch (e) {
      console.error('Techniques load error:', e)
      setToast({ message: T('error'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(t) {
    setEditing(t)
    setForm({ name: t.name, base_preset: t.base_preset ?? '', active: t.active })
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await upsertPrintTechnique({ ...(editing ? { id: editing.id } : {}), ...form })
      setModal(false)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deletePrintTechnique(id)
      setConfirm(null)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  async function handleAddTc(techniqueId) {
    if (!tcForm.cost_item_id) return
    setSaving(true)
    try {
      await upsertTechniqueCost({
        technique_id: techniqueId,
        cost_item_id: tcForm.cost_item_id,
        quantity: parseFloat(tcForm.quantity) || 1,
        category: tcForm.category,
      })
      setAddingTc(null)
      setTcForm({ cost_item_id: '', quantity: '1', category: 'ORIGINATION' })
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDeleteTc(id) {
    try {
      await deleteTechniqueCost(id)
      setConfirmTc(null)
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  const filtered = techniques.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <PageHeader title={T('techniques_title')}
        action={<Btn onClick={openNew}><Plus size={15}/>{T('new_technique')}</Btn>} />

      <div className="mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder={T('search')} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div>{T('loading')}</div>
          <button onClick={load} className="mt-4 text-xs text-slate-500 underline hover:text-slate-700">
            Taking too long? Click to retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message={T('noResults')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(tech => {
            const isOpen = expanded === tech.id
            return (
              <div key={tech.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => setExpanded(isOpen ? null : tech.id)}
                    className="text-gray-400 hover:text-gray-700 transition-colors">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{tech.name}</span>
                    {tech.base_preset && (
                      <span className="ml-2 text-xs text-gray-400">{tech.base_preset}</span>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full ${tech.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-400">{tech.technique_costs?.length ?? 0} costs</span>
                  <button onClick={() => openEdit(tech)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Pencil size={14}/>
                  </button>
                  <button onClick={() => setConfirm(tech.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14}/>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{T('technique_costs')}</p>
                      <Btn size="sm" variant="secondary" onClick={() => setAddingTc(tech.id)}>
                        <Plus size={12}/>{T('add_cost_to_technique')}
                      </Btn>
                    </div>

                    {addingTc === tech.id && (
                      <div className="bg-gray-50 rounded-xl p-4 mb-3 flex flex-wrap gap-3 items-end">
                        <Select label="Cost item" value={tcForm.cost_item_id}
                          onChange={e => setTcForm(f => ({ ...f, cost_item_id: e.target.value }))}
                          className="flex-1 min-w-40">
                          <option value="">— select —</option>
                          {allCosts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                        </Select>
                        <Input label={T('quantity')} type="number" step="0.0001" min="0"
                          value={tcForm.quantity}
                          onChange={e => setTcForm(f => ({ ...f, quantity: e.target.value }))}
                          className="w-28" />
                        <Select label={T('category')} value={tcForm.category}
                          onChange={e => setTcForm(f => ({ ...f, category: e.target.value }))}
                          className="w-36">
                          <option value="ORIGINATION">Origination</option>
                          <option value="HIT">Hit</option>
                        </Select>
                        <div className="flex gap-2">
                          <Btn size="sm" onClick={() => handleAddTc(tech.id)} disabled={saving}>{T('add')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setAddingTc(null)}>{T('cancel')}</Btn>
                        </div>
                      </div>
                    )}

                    {tech.technique_costs?.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No costs configured</p>
                    ) : (
                      <div className="space-y-1.5">
                        {tech.technique_costs?.map(tc => (
                          <div key={tc.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                            <CategoryBadge category={tc.category} />
                            <span className="flex-1 text-sm text-gray-700">{tc.cost_items?.name}</span>
                            <span className="text-xs text-gray-400">{tc.quantity} {tc.cost_items?.unit}</span>
                            <span className="text-xs font-mono text-gray-500">
                              {fmt(tc.quantity * (tc.cost_items?.value_per_unit ?? 0))}
                            </span>
                            <button onClick={() => setConfirmTc(tc.id)}
                              className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? T('edit_technique') : T('new_technique')} width="max-w-md">
        <div className="space-y-4">
          <Input label={T('name')} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Select label={T('preset')} value={form.base_preset}
            onChange={e => setForm(f => ({ ...f, base_preset: e.target.value }))}>
            <option value="">— none —</option>
            {PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
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
      <Confirm open={!!confirmTc} message={T('confirm_delete')}
        onConfirm={() => handleDeleteTc(confirmTc)} onCancel={() => setConfirmTc(null)} />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
