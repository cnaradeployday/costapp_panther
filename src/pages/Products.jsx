import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getProducts, upsertProduct, deleteProduct,
  getCostItems, upsertProductCost, deleteProductCost
} from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Select, EmptyState, PageHeader, SearchInput, Toggle } from '../components/ui'

const empty = { sku: '', name: '', ncm: '', origin_country: '', fob_price: '', weight_kg: '', length_cm: '', width_cm: '', height_cm: '', hs_code_id: '', active: true }

const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']

function isEuOrigin(country) {
  if (!country) return false
  return EU_COUNTRIES.includes(country.toUpperCase().trim())
}

async function getHsCodes() {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.from('hs_codes').select('*').eq('active', true).order('code')
  if (error) throw error
  return data
}

export default function ProductsPage() {
  const { T, fmt, tabVisible } = useApp()
  const [products, setProducts] = useState([])
  const [landedCosts, setLandedCosts] = useState([])
  const [hsCodes, setHsCodes] = useState([])
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
      const [prods, costs, hs] = await Promise.all([getProducts(), getCostItems('LANDED'), getHsCodes()])
      setProducts(prods)
      setLandedCosts(costs.filter(c => c.active))
      setHsCodes(hs)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(p) {
    setEditing(p)
    setForm({
      sku: p.sku, name: p.name, ncm: p.ncm ?? '', origin_country: p.origin_country ?? '',
      fob_price: String(p.fob_price),
      weight_kg: p.weight_kg ? String(p.weight_kg) : '',
      length_cm: p.length_cm ? String(p.length_cm) : '',
      width_cm: p.width_cm ? String(p.width_cm) : '',
      height_cm: p.height_cm ? String(p.height_cm) : '',
      hs_code_id: p.hs_code_id ?? '',
      active: p.active
    })
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
        weight_kg: parseFloat(form.weight_kg) || 0,
        length_cm: parseFloat(form.length_cm) || 0,
        width_cm: parseFloat(form.width_cm) || 0,
        height_cm: parseFloat(form.height_cm) || 0,
        hs_code_id: form.hs_code_id || null,
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
      const payload = { product_id: productId, cost_item_id: pcForm.cost_item_id, quantity: parseFloat(pcForm.quantity) || 1 }
      if (pcForm.value_override !== '') payload.value_override = parseFloat(pcForm.value_override)
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
      await deleteProductCost(id); setConfirmPc(null); await load()
    } catch { setToast({ message: T('error'), type: 'error' }) }
  }

  function getEffectiveValue(pc, fob) {
    const ci = pc.cost_items
    if (!ci) return 0
    const val = pc.value_override !== null && pc.value_override !== undefined
      ? parseFloat(pc.value_override)
      : parseFloat(ci.value_per_unit)
    if (ci.value_type === 'percentage_of_fob') return (val / 100) * parseFloat(fob)
    return val * parseFloat(pc.quantity)
  }

  // Calcular arancel automático basado en HS code y país de origen
  function calcImportDuty(product) {
    if (!product.hs_code_id) return null
    const hs = hsCodes.find(h => h.id === product.hs_code_id)
    if (!hs) return null
    const fob = parseFloat(product.fob_price) || 0
    const isEu = isEuOrigin(product.origin_country)
    const rate = isEu ? 0 : parseFloat(hs.duty_rate)
    return { hs, rate, amount: fob * rate, isEu }
  }

  const selectedCostItem = landedCosts.find(c => c.id === pcForm.cost_item_id)
  const isPct = selectedCostItem?.value_type === 'percentage_of_fob'

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  // Volumen en m³
  function volM3(p) {
    const l = parseFloat(p.length_cm) || 0
    const w = parseFloat(p.width_cm) || 0
    const h = parseFloat(p.height_cm) || 0
    return l * w * h / 1_000_000
  }

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
            const duty = calcImportDuty(prod)
            const dutyAmount = duty?.amount || 0
            const hs = hsCodes.find(h => h.id === prod.hs_code_id)
            const vol = volM3(prod)

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
                      {hs && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                          HS {hs.code} · {duty?.isEu ? '0% EU' : `${(hs.duty_rate * 100).toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      <span>FOB {fmt(prod.fob_price)}</span>
                      {prod.origin_country && <span>· {prod.origin_country}</span>}
                      {vol > 0 && <span>· {vol.toFixed(4)} m³</span>}
                      {prod.weight_kg > 0 && <span>· {prod.weight_kg} kg</span>}
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${prod.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-400 font-mono">
                    Landed: {fmt(fob + totalLanded + dutyAmount)}
                  </span>
                  <button onClick={() => openEdit(prod)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Pencil size={14}/>
                  </button>
                  <button onClick={() => setConfirm(prod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14}/>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-4">
                    {/* Import duty automático */}
                    {hs && (
                      <div className={`mb-4 rounded-xl px-4 py-3 flex items-center gap-3 ${duty?.isEu ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-600">Import duty (HS {hs.code})</span>
                          <span className="text-xs text-gray-400 ml-2">{hs.description}</span>
                        </div>
                        {duty?.isEu ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg font-medium">EU origin — 0% duty</span>
                        ) : (
                          <span className="text-xs font-mono font-medium text-amber-700">
                            {(hs.duty_rate * 100).toFixed(2)}% × {fmt(fob)} = {fmt(dutyAmount)}
                          </span>
                        )}
                      </div>
                    )}

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
                              placeholder={selectedCostItem ? fmt(selectedCostItem.value_per_unit) : '—'}
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
                            ? (pc.value_override + (isPctCost ? '% FOB*' : ' (override)*'))`
                            : isPctCost ? `${pc.cost_items?.value_per_unit}% FOBa : `${pc.quantity} ${pc.cost_items?.unit}`
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
                            Total landed: {fmt(fob + totalLanded + dutyAmount)}
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

      {/* Modal edición */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? T('edit_product') : T('new_product')} width="max-w-2xl">
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
              onChange={e => setForm(f => ({ ...f, origin_country: e.target.value }))}
              placeholder="e.g. CHINA, ES, DE" />
            <Input label={T('fob_price')} type="number" step="0.0001" min="0"
              value={form.fob_price}
              onChange={e => setForm(f => ({ ...f, fob_price: e.target.value }))} />
          </div>

          {/* HS Code */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">HS Code (import duties)</label>
            <select value={form.hs_code_id}
              onChange={e => setForm(f => ({ ...f, hs_code_id: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">— no HS code —</option>
              {hsCodes.map(h => (
                <option key={h.id} value={h.id}>
                  {h.code} · {h.description} · {(h.duty_rate * 100).toFixed(2)}% (non-EU)
                </option>
              ))}
            </select>
            {form.hs_code_id && form.origin_country && (
              <p className={`text-xs mt-1 ${isEuOrigin(form.origin_country) ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isEuOrigin(form.origin_country)
                  ? `✓ EU origin (${form.origin_country.toUpperCase()}) — 0% import duty`
                  : `⚠ Non-EU origin — ${(hsCodes.find(h => h.id === form.hs_code_id)?.duty_rate * 100 || 0).toFixed(2)}% duty applies`
                }
              </p>
            )}
          </div>

          {/* Dimensiones y peso */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Dimensions & Weight (for LANDED volume calculation)</p>
            <div className="grid grid-cols-4 gap-3">
              <Input label="Weight (kg)" type="number" step="0.0001" min="0"
                value={form.weight_kg}
                onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
              <Input label="Length (cm)" type="number" step="0.01" min="0"
                value={form.length_cm}
                onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} />
              <Input label="Width (cm)" type="number" step="0.01" min="0"
                value={form.width_cm}
                onChange={e => setForm(f => ({ ...f, width_cm: e.target.value }))} />
              <Input label="Height (cm)" type="number" step="0.01" min="0"
                value={form.height_cm}
                onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} />
            </div>
            {form.length_cm && form.width_cm && form.height_cm && (
              <p className="text-xs text-gray-400 mt-2">
                Volume: {((parseFloat(form.length_cm)||0) * (parseFloat(form.width_cm)||0) * (parseFloat(form.height_cm)||0) / 1_000_000).toFixed(6)} m³
              </p>
            )}
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
