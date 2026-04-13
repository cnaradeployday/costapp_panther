import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getProducts, upsertProduct, deleteProduct,
  getCostItems, upsertProductCost, deleteProductCost
} from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Select, EmptyState, PageHeader, SearchInput, Toggle } from '../components/ui'

const empty = { sku: '', name: '', ncm: '', origin_country: '', fob_price: '', active: true }

export default function ProductsPage() {
  const { T, fmt, tabVisible } = useApp()
  const [products, setProducts] = useState([])
  const [landedCosts, setLandedCosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmPc, setConfirmPc] = useState(null)
  const [toast, setToast] = useState(null)
  const [addingPc, setAddingPc] = useState(null)
  const [pcForm, setPcForm] = useState({ cost_item_id: '', quantity: '1', value_override: '' })

  async function load() {
    setLoading(true)
    try {
      const [prods, costs] = await Promise.all([getProducts(), getCostItems('LANDED')])
      setProducts(prods)
      setLandedCosts(costs.filter(c => c.active))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(p) {
    setEditing(p)
    setForm({ sku: p.sku, name: p.name, ncm: p.ncm ?? '', origin_country: p.origin_country ?? '', fob_price: String(p.fob_price), active: p.active })
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await upsertProduct({
        ...(editing ? { id: editing.id } : {}),
        sku: form.sku, name: form.name, ncm: form.ncm,
        origin_country: form.origin_country,
        fob_price: parseFloat(form.fob_price) || 0,
        active: form.active,
      })
      setModal(false)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e.message?.includes('sku') ? 'SKU already exists' : T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteProduct(id); setConfirm(null)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  async function handleAddPc(productId) {
    if (!pcForm.cost_item_id) return
    setSaving(true)
    try {
      const payload = {
        product_id: productId,
        cost_item_id: pcForm.cost_item_id,
        quantity: parseFloat(pcForm.quantity) || 1,
      }
      if (pcForm.value_override !== '') {
        payload.value_override = parseFloat(pcForm.value_override)
      }
      await upsertProductCost(payload)
      setAddingPc(null)
      setPcForm({ cost_item_id: '', quantity: '1', value_override: '' })
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch { setToast({ message: T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDeletePc(id) {
    try {
      await deleteProductCost(id); setConfirmPc(null)
      await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  function getEffectiveValue(pc, fob) {
    const ci = pc.cost_items
    if (!ci) return 0
    const val = pc.value_override !== null && pc.value_override !== undefined
      ? parseFloat(pc.value_override)
      : parseFloat(ci.value_per_unit)
    if (ci.value_type === 'percentage_of_fob') {
      return (val / 100) * parseFloat(fob)
    }
    return val * parseFloat(pc.quantity)
  }

  const selectedCostItem = landedCosts.find(c => c.cost_item_id === pcForm.cost_item_id) ||
    landedCosts.find(c => c.id === pcForm.cost_item_id)
  const isPct = selectedCostItem?.value_type === 'percentage_of_fob'

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title={T('products_title')}
        action={<Btn onClick={openNew}><Plus size={15}/>{T('new_product')}</Btn>} />

      <div className="mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder={T('search')} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>
      ) : filtered.length === 0 ? (
        <EmptyState message={T('noResults')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(prod => {
            const isOpen = expanded === prod.id
            const fob = parseFloat(prod.fob_price) || 0
            const totalLanded = prod.product_costs?.reduce((s, pc) => s + getEffectiveValue(pc, fob), 0) ?? 0

            return (
              <div key={prod.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => setExpanded(isOpen ? null : prod.id)}
                    className="text-gray-400 hover:text-gray-700">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{prod.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-mono">{prod.sku}</span>
                      {prod.ncm && <span className="text-xs text-gray-400">NCM {prod.ncm}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      FOB {fmt(prod.fob_price)} · {prod.origin_country}
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${prod.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-400 font-mono">Landed: {fmt(fob + totalLanded)}</span>
                  <button onClick={() => openEdit(prod)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Pencil size={14}/>
                  </button>
                  <button onClick={() => setConfirm(prod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14}/>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{T('landed_costs')}</p>
                      <Btn size="sm" variant="secondary" onClick={() => setAddingPc(prod.id)}>
                        <Plus size={12}/>{T('add_landed_cost')}
                      </Btn>
                    </div>

                    {addingPc === prod.id && (
                      <div className="bg-gray-50 rounded-xl p-4 mb-3 flex flex-wrap gap-3 items-end">
                        <Select label="Cost" value={pcForm.cost_item_id}
                          onChange={e => setPcForm(f => ({ ...f, cost_item_id: e.target.value, value_override: '' }))}
                          className="flex-1 min-w-40">
                          <option value="">— select —</option>
                          {landedCosts.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.value_type === 'percentage_of_fob' ? '(% FOB)' : `(${c.unit})`}
                            </option>
                          ))}
                        </Select>

                        {isPct ? (
                          <Input label="Rate % (override)" type="number" step="0.01" min="0"
                            value={pcForm.value_override}
                            placeholder={`default: ${selectedCostItem?.value_per_unit}%`}
                            onChange={e => setPcForm(f => ({ ...f, value_override: e.target.value }))}
                            className="w-40" />
                        ) : (
                          <>
                            <Input label="Quantity" type="number" step="0.0001" min="0"
                              value={pcForm.quantity}
                              onChange={e => setPcForm(f => ({ ...f, quantity: e.target.value }))}
                              className="w-28" />
                            <Input label="Value override (optional)" type="number" step="0.0001" min="0"
                              value={pcForm.value_override}
                              placeholder={`default: ${selectedCostItem ? fmt(selectedCostItem.value_per_unit) : '—'}`}
                              onChange={e => setPcForm(f => ({ ...f, value_override: e.target.value }))}
                              className="w-40" />
                          </>
                        )}

                        <div className="flex gap-2">
                          <Btn size="sm" onClick={() => handleAddPc(prod.id)} disabled={saving}>{T('add')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setAddingPc(null)}>{T('cancel')}</Btn>
                        </div>
                      </div>
                    )}

                    {prod.product_costs?.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No landed costs configured</p>
                    ) : (
                      <div className="space-y-1.5">
                        {prod.product_costs?.map(pc => {
                          const effective = getEffectiveValue(pc, fob)
                          const isPctCost = pc.cost_items?.value_type === 'percentage_of_fob'
                          const displayVal = pc.value_override !== null && pc.value_override !== undefined
                            ? `${pc.value_override}${isPctCost ? '% FOB*' : ` (override)*`}`
                            : isPctCost ? `${pc.cost_items?.value_per_unit}% FOB` : `${pc.quantity} ${pc.cost_items?.unit}`
                          return (
                            <div key={pc.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                              <span className="flex-1 text-sm text-gray-700">{pc.cost_items?.name}</span>
                              <span className="text-xs text-gray-400">{displayVal}</span>
                              <span className="text-xs font-mono text-gray-500">{fmt(effective)}</span>
                              <button onClick={() => setConfirmPc(pc.id)}
                                className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          )
                        })}
                        <div className="flex justify-end pt-1">
                          <span className="text-xs font-semibold text-gray-700">
                            Total landed: {fmt(fob + totalLanded)}
                          </span>
                        </div>
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
        title={editing ? T('edit_product') : T('new_product')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={T('sku')} value={form.sku}
              onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} required />
            <Input label={T('ncm')} value={form.ncm}
              onChange={e => setForm(f => ({ ...f, ncm: e.target.value }))} />
          </div>
          <Input label={T('name')} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label={T('origin_country')} value={form.origin_country}
              onChange={e => setForm(f => ({ ...f, origin_country: e.target.value }))} />
            <Input label={T('fob_price')} type="number" step="0.0001" min="0"
              value={form.fob_price}
              onChange={e => setForm(f => ({ ...f, fob_price: e.target.value }))} />
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
      <Confirm open={!!confirmPc} message={T('confirm_delete')}
        onConfirm={() => handleDeletePc(confirmPc)} onCancel={() => setConfirmPc(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
