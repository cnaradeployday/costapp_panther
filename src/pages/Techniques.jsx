import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import {
  getPrintTechniques, upsertPrintTechnique, deletePrintTechnique,
  getCostItems, upsertTechniqueCost, deleteTechniqueCost, reorderTechniqueCosts,
  getMarginTiers
} from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { costType, effectiveRate, lineRate, lineTotal, defaultMarginPct, effectiveMarginPct } from '../lib/techniqueCosts'
import {
  Modal, Confirm, Toast, Btn, Input, Select, Badge,
  EmptyState, PageHeader, SearchInput, Toggle, ExportExcelButton
} from '../components/ui'
import { exportToExcel } from '../lib/exportExcel'

const PRESETS = ['pad_printing', 'screen_printing', 'embroidery', 'laser', 'dtf', 'sublimation', 'uv_printing', 'other']
const empty = { name: '', base_preset: '', active: true }
const fmt2 = n => (parseFloat(n) || 0).toFixed(2)

function EditableCell({ value, onCommit, placeholder = '—' }) {
  const [local, setLocal] = useState(value ?? '')
  useEffect(() => { setLocal(value ?? '') }, [value])
  return (
    <input
      type="number" step="0.0001" min="0"
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const num = local === '' ? null : parseFloat(local)
        if (num !== (value ?? null)) onCommit(num)
      }}
      className="w-20 text-right text-sm font-mono bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    />
  )
}

export default function TechniquesPage() {
  const { T, currency, tabVisible } = useApp()
  const [techniques, setTechniques] = useState([])
  const [allCosts, setAllCosts] = useState([])
  const [tiers, setTiers] = useState([])
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
  const [tcForm, setTcForm] = useState({ cost_item_id: '', quantity: '1', min_charge: '', margin_pct: '' })
  const [addingTc, setAddingTc] = useState(null)
  const [editingTcId, setEditingTcId] = useState(null)
  const [dragInfo, setDragInfo] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [tech, costs, trs] = await Promise.all([getPrintTechniques(), getCostItems(), getMarginTiers()])
      setTechniques(tech)
      setAllCosts(costs.filter(c => c.category !== 'LANDED' && c.active))
      setTiers(trs)
    } catch (e) {
      console.error('Techniques load error:', e)
      setToast({ message: T('error'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tabVisible])

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
    const item = allCosts.find(c => c.id === tcForm.cost_item_id)
    if (!item) return
    setSaving(true)
    try {
      const tech = techniques.find(t => t.id === techniqueId)
      await upsertTechniqueCost({
        ...(editingTcId ? { id: editingTcId } : {}),
        technique_id: techniqueId,
        cost_item_id: item.id,
        quantity: parseFloat(tcForm.quantity) || 1,
        category: item.category, // inherited from the Cost Item — kept in sync with the Costs page, never re-picked here
        min_charge: tcForm.min_charge === '' ? null : parseFloat(tcForm.min_charge),
        margin_pct: tcForm.margin_pct === '' ? null : parseFloat(tcForm.margin_pct),
        sort_order: tech?.technique_costs?.length ?? 0,
      })
      setAddingTc(null)
      setEditingTcId(null)
      setTcForm({ cost_item_id: '', quantity: '1', min_charge: '', margin_pct: '' })
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  function openEditTc(tc) {
    setTcForm({ cost_item_id: tc.cost_item_id, quantity: String(tc.quantity), min_charge: tc.min_charge ?? '', margin_pct: tc.margin_pct ?? '' })
    setEditingTcId(tc.id)
    setAddingTc(tc.technique_id)
  }

  function cancelTc() {
    setAddingTc(null)
    setEditingTcId(null)
    setTcForm({ cost_item_id: '', quantity: '1', min_charge: '', margin_pct: '' })
  }

  async function handleDeleteTc(id) {
    try {
      await deleteTechniqueCost(id)
      setConfirmTc(null)
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  function updateTcLocal(techId, tcId, patch) {
    setTechniques(prev => prev.map(t => t.id !== techId ? t : {
      ...t,
      technique_costs: t.technique_costs.map(tc => tc.id === tcId ? { ...tc, ...patch } : tc)
    }))
  }

  async function commitTcField(techId, tcId, field, value) {
    updateTcLocal(techId, tcId, { [field]: value })
    try {
      await upsertTechniqueCost({ id: tcId, [field]: value })
    } catch {
      setToast({ message: T('error'), type: 'error' })
      await load()
    }
  }

  function handleDrop(techId, toIdx) {
    if (!dragInfo || dragInfo.techId !== techId || dragInfo.fromIdx === toIdx) { setDragInfo(null); return }
    const tech = techniques.find(t => t.id === techId)
    if (!tech) { setDragInfo(null); return }
    const rows = [...tech.technique_costs]
    const [moved] = rows.splice(dragInfo.fromIdx, 1)
    rows.splice(toIdx, 0, moved)
    setDragInfo(null)
    setTechniques(prev => prev.map(t => t.id === techId ? { ...t, technique_costs: rows } : t))
    reorderTechniqueCosts(rows.map((tc, idx) => ({ id: tc.id, sort_order: idx })))
      .catch(() => setToast({ message: T('error'), type: 'error' }))
  }

  const filtered = techniques.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  async function handleExport() {
    try {
      await exportToExcel('techniques.xlsx', 'Techniques',
        ['Technique', T('active'), 'Step', 'Description', 'Cost type', 'Unit', 'Qty', `Cost/unit (${currency})`, `Total cost (${currency})`, 'Min charge', 'Margin %'],
        filtered.flatMap(tech =>
          tech.technique_costs?.length
            ? tech.technique_costs.map((tc, idx) => [
                tech.name, tech.active ? 'Yes' : 'No', idx + 1, tc.cost_items?.name || '',
                costType(tc.category), tc.cost_items?.unit || '', tc.quantity,
                fmt2(lineRate(tc)), fmt2(lineTotal(tc)), tc.min_charge ?? '', effectiveMarginPct(tc, tiers),
              ])
            : [[tech.name, tech.active ? 'Yes' : 'No', '', '', '', '', '', '', '', '', '']]
        ))
    } catch (e) {
      console.error('Excel export error:', e)
      setToast({ message: T('error'), type: 'error' })
    }
  }

  return (
    <div>
      <PageHeader title={T('techniques_title')}
        action={<div className="flex gap-2"><ExportExcelButton onClick={handleExport} disabled={!filtered.length} /><Btn onClick={openNew}><Plus size={15}/>{T('new_technique')}</Btn></div>} />

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
                      <Btn size="sm" variant="secondary" onClick={() => { setEditingTcId(null); setTcForm({ cost_item_id: '', quantity: '1', min_charge: '', margin_pct: '' }); setAddingTc(tech.id) }}>
                        <Plus size={12}/>{T('add_cost_to_technique')}
                      </Btn>
                    </div>

                    {addingTc === tech.id && (() => {
                      const selectedItem = allCosts.find(c => c.id === tcForm.cost_item_id)
                      return (
                        <div className="bg-gray-50 rounded-xl p-4 mb-3 flex flex-wrap gap-3 items-end">
                          <Select label="Description (cost item)" value={tcForm.cost_item_id}
                            onChange={e => setTcForm(f => ({ ...f, cost_item_id: e.target.value }))}
                            className="flex-1 min-w-40">
                            <option value="">— select —</option>
                            {allCosts
                              .filter(c => !c.technique_ids?.length || c.technique_ids.includes(tech.id))
                              .filter(c => c.id === tcForm.cost_item_id || !tech.technique_costs?.some(tc => tc.cost_item_id === c.id))
                              .map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                          </Select>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Cost type</label>
                            <div className="h-[38px] flex items-center">
                              {selectedItem
                                ? <Badge color={costType(selectedItem.category) === 'FIX' ? 'amber' : 'emerald'}>{costType(selectedItem.category)}</Badge>
                                : <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </div>
                          <Input label={T('quantity')} type="number" step="0.0001" min="0"
                            value={tcForm.quantity}
                            onChange={e => setTcForm(f => ({ ...f, quantity: e.target.value }))}
                            className="w-24" />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Cost per unit</label>
                            <div className="h-[38px] flex items-center text-sm font-mono text-gray-500">
                              {selectedItem ? `${currency} ${fmt2(effectiveRate(selectedItem))}` : '—'}
                            </div>
                          </div>
                          <Input label="Min charge" type="number" step="0.01" min="0"
                            value={tcForm.min_charge}
                            onChange={e => setTcForm(f => ({ ...f, min_charge: e.target.value }))}
                            className="w-24" placeholder="—" />
                          <Input label="Margin %" type="number" step="0.1" min="0" max="100"
                            value={tcForm.margin_pct}
                            onChange={e => setTcForm(f => ({ ...f, margin_pct: e.target.value }))}
                            className="w-24" placeholder={`${defaultMarginPct(tiers)} (general)`} />
                          <div className="flex gap-2">
                            <Btn size="sm" onClick={() => handleAddTc(tech.id)} disabled={saving || !tcForm.cost_item_id}>{editingTcId ? T('save') : T('add')}</Btn>
                            <Btn size="sm" variant="ghost" onClick={cancelTc}>{T('cancel')}</Btn>
                          </div>
                        </div>
                      )
                    })()}

                    {tech.technique_costs?.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No costs configured</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                              <th className="w-8" />
                              <th className="text-left px-2 py-2 w-10">Step</th>
                              <th className="text-left px-2 py-2">Description</th>
                              <th className="text-left px-2 py-2">Cost type</th>
                              <th className="text-left px-2 py-2">Unit of measure</th>
                              <th className="text-right px-2 py-2">Qty</th>
                              <th className="text-right px-2 py-2">Cost per unit of measure</th>
                              <th className="text-right px-2 py-2">Total cost</th>
                              <th className="text-right px-2 py-2">Min charge</th>
                              <th className="text-right px-2 py-2">Margin %</th>
                              <th className="w-8" />
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {tech.technique_costs?.map((tc, idx) => {
                              const raw = (parseFloat(tc.quantity) || 0) * lineRate(tc)
                              const total = lineTotal(tc)
                              const floored = tc.min_charge !== null && tc.min_charge !== undefined && tc.min_charge !== '' &&
                                parseFloat(tc.min_charge) > raw
                              return (
                                <tr key={tc.id}
                                  draggable
                                  onDragStart={() => setDragInfo({ techId: tech.id, fromIdx: idx })}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={() => handleDrop(tech.id, idx)}
                                  className={`border-t border-gray-50 hover:bg-gray-50 transition-colors ${dragInfo?.techId === tech.id && dragInfo.fromIdx === idx ? 'opacity-40' : ''}`}>
                                  <td className="px-2 py-1.5 text-gray-300 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={14}/>
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                                  <td className="px-2 py-1.5 text-gray-700">{tc.cost_items?.name}</td>
                                  <td className="px-2 py-1.5">
                                    <Badge color={costType(tc.category) === 'FIX' ? 'amber' : 'emerald'}>
                                      {costType(tc.category)}
                                    </Badge>
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-400 text-xs">{tc.cost_items?.unit}</td>
                                  <td className="px-2 py-1.5 text-right">
                                    <EditableCell value={tc.quantity}
                                      onCommit={v => commitTcField(tech.id, tc.id, 'quantity', v ?? 0)} />
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono text-gray-500 text-xs">
                                    {currency} {fmt2(lineRate(tc))}
                                  </td>
                                  <td className={`px-2 py-1.5 text-right font-mono text-xs font-semibold ${floored ? 'text-amber-600' : 'text-gray-700'}`}>
                                    {currency} {fmt2(total)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <EditableCell value={tc.min_charge}
                                      onCommit={v => commitTcField(tech.id, tc.id, 'min_charge', v)} />
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <EditableCell value={effectiveMarginPct(tc, tiers)}
                                      onCommit={v => commitTcField(tech.id, tc.id, 'margin_pct', v)} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <button onClick={() => openEditTc(tc)}
                                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600">
                                      <Pencil size={12}/>
                                    </button>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <button onClick={() => setConfirmTc(tc.id)}
                                      className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
                                      <Trash2 size={12}/>
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
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
