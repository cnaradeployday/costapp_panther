import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Package, Calculator, CheckCircle, Archive, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getLandedOperations, upsertLandedOperation, deleteLandedOperation,
  upsertLandedLine, deleteLandedLine,
  getLogisticsRoutes, getWarehouses, getAncillaryCosts, getActiveRate
} from '../lib/landed'
import { getProducts } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, PageHeader, EmptyState } from '../components/ui'

const STATUS_COLORS = {
  draft: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-gray-100 text-gray-500',
}

function volM3(p, qty = 1) {
  const l = parseFloat(p.length_cm) || 0
  const w = parseFloat(p.width_cm) || 0
  const h = parseFloat(p.height_cm) || 0
  return (l * w * h / 1_000_000) * qty
}

function calcVolumetricWeight(p, qty = 1) {
  // Peso volumétrico: (l*w*h)/5000 por unidad (estándar aéreo)
  const l = parseFloat(p.length_cm) || 0
  const w = parseFloat(p.width_cm) || 0
  const h = parseFloat(p.height_cm) || 0
  return (l * w * h / 5000) * qty
}

function effectiveWeight(p, qty = 1) {
  const actual = (parseFloat(p.weight_kg) || 0) * qty
  const volumetric = calcVolumetricWeight(p, qty)
  return Math.max(actual, volumetric)
}

export default function LandedCalculatorPage() {
  const { tabVisible, fmt } = useApp()
  const [operations, setOperations] = useState([])
  const [products, setProducts] = useState([])
  const [routes, setRoutes] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const [opModal, setOpModal] = useState(false)
  const [editingOp, setEditingOp] = useState(null)
  const [opForm, setOpForm] = useState({ name: '', route_id: '', warehouse_id: '', operation_date: new Date().toISOString().split('T')[0], notes: '' })

  const [calcState, setCalcState] = useState({}) // opId -> { lines, ancillary, result }
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [ops, prods, rts, whs] = await Promise.all([
        getLandedOperations(), getProducts(), getLogisticsRoutes(), getWarehouses()
      ])
      setOperations(ops)
      setProducts(prods)
      setRoutes(rts)
      setWarehouses(whs)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  async function initCalcState(op) {
    const route = routes.find(r => r.id === op.route_id)
    if (!route) return
    const ancillary = await getAncillaryCosts(route.partner_id)
    const lines = (op.landed_operation_lines || []).map(l => ({
      ...l,
      product: products.find(p => p.id === l.product_id),
    }))
    setCalcState(prev => ({ ...prev, [op.id]: { lines, ancillary, addingProduct: '', addingQty: '1' } }))
  }

  async function openOp(op) {
    if (expanded === op.id) { setExpanded(null); return }
    setExpanded(op.id)
    if (!calcState[op.id]) await initCalcState(op)
  }

  function openNewOp() {
    setEditingOp(null)
    const defaultWarehouse = warehouses.find(w => w.is_default)
    setOpForm({
      name: '', route_id: routes[0]?.id || '', notes: '',
      warehouse_id: defaultWarehouse?.id || warehouses[0]?.id || '',
      operation_date: new Date().toISOString().split('T')[0]
    })
    setOpModal(true)
  }

  async function handleSaveOp() {
    if (!opForm.name || !opForm.route_id) return
    setSaving(true)
    try {
      await upsertLandedOperation({ ...(editingOp ? { id: editingOp.id } : {}), ...opForm })
      setOpModal(false); setToast({ message: 'Operation saved', type: 'success' }); await load()
    } catch { setToast({ message: 'Error', type: 'error' }) } finally { setSaving(false) }
  }

  async function handleAddLine(opId) {
    const state = calcState[opId]
    if (!state?.addingProduct) return
    const product = products.find(p => p.id === state.addingProduct)
    if (!product) return
    const qty = parseInt(state.addingQty) || 1
    setSaving(true)
    try {
      const vol = volM3(product, qty)
      const wkg = effectiveWeight(product, qty)
      const saved = await upsertLandedLine({
        operation_id: opId, product_id: product.id, quantity: qty,
        weight_kg: wkg, volume_m3: vol,
      })
      setCalcState(prev => ({
        ...prev,
        [opId]: {
          ...prev[opId],
          lines: [...(prev[opId]?.lines || []), { ...saved, product }],
          addingProduct: '', addingQty: '1'
        }
      }))
      await recalculate(opId, [...(state.lines || []), { ...saved, product }], state.ancillary)
    } catch { setToast({ message: 'Error adding product', type: 'error' }) } finally { setSaving(false) }
  }

  async function handleDeleteLine(opId, lineId) {
    try {
      await deleteLandedLine(lineId)
      const state = calcState[opId]
      const newLines = state.lines.filter(l => l.id !== lineId)
      setCalcState(prev => ({ ...prev, [opId]: { ...prev[opId], lines: newLines } }))
      await recalculate(opId, newLines, state.ancillary)
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  async function recalculate(opId, lines, ancillary) {
    const op = operations.find(o => o.id === opId)
    const route = routes.find(r => r.id === op?.route_id)
    if (!route || lines.length === 0) return

    const totalVol = lines.reduce((s, l) => s + (parseFloat(l.volume_m3) || 0), 0)
    const totalWeight = lines.reduce((s, l) => s + (parseFloat(l.weight_kg) || 0), 0)

    // Calcular costo de flete
    let freightOriginal = 0
    if (route.pricing_type === 'Unit') {
      freightOriginal = parseFloat(route.unit_cost) || 0
    } else {
      const measure = route.cost_measurement === 'Kilo' ? totalWeight : totalVol
      const tiers = (route.logistics_price_tiers || []).sort((a, b) => a.qty_from - b.qty_from)
      const tier = tiers.reverse().find(t => measure >= t.qty_from)
      freightOriginal = tier ? parseFloat(tier.price) * measure : 0
    }

    // Convertir a EUR
    const today = new Date().toISOString().split('T')[0]
    let freightEur = freightOriginal
    if (route.currency !== 'EUR') {
      const rateData = await getActiveRate(route.currency, 'EUR', today)
      if (rateData) freightEur = freightOriginal * parseFloat(rateData.rate)
    }

    // Calcular ancillary costs (en EUR, ya son locales)
    const activeAncillary = (ancillary || []).filter(a => {
      if (!a.active) return false
      if (a.valid_to && a.valid_to < today) return false
      if (!a.load_units?.length) return true
      return a.load_units.includes(route.load_unit)
    })
    const ancillaryTotal = activeAncillary.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)

    const totalLandedEur = freightEur + ancillaryTotal

    // Prorratear por volumen
    const updatedLines = lines.map(l => {
      const ratio = totalVol > 0 ? (parseFloat(l.volume_m3) || 0) / totalVol : 1 / lines.length
      const freightAlloc = freightEur * ratio
      const ancillaryAlloc = ancillaryTotal * ratio
      const qty = parseInt(l.quantity) || 1
      return {
        ...l,
        volume_ratio: ratio,
        freight_allocated_eur: freightAlloc,
        ancillary_allocated_eur: ancillaryAlloc,
        total_landed_unit_eur: (freightAlloc + ancillaryAlloc) / qty,
      }
    })

    // Guardar en DB
    for (const l of updatedLines) {
      if (l.id) {
        await upsertLandedLine({
          id: l.id, operation_id: opId, product_id: l.product_id,
          quantity: l.quantity, weight_kg: l.weight_kg, volume_m3: l.volume_m3,
          volume_ratio: l.volume_ratio,
          freight_allocated_eur: l.freight_allocated_eur,
          ancillary_allocated_eur: l.ancillary_allocated_eur,
          total_landed_unit_eur: l.total_landed_unit_eur,
        })
      }
    }

    await upsertLandedOperation({
      id: opId, name: op.name, route_id: op.route_id, warehouse_id: op.warehouse_id,
      operation_date: op.operation_date,
      total_volume_m3: totalVol, total_weight_kg: totalWeight,
      freight_cost_original: freightOriginal, freight_cost_eur: freightEur,
      ancillary_cost_eur: ancillaryTotal, total_landed_eur: totalLandedEur,
    })

    setCalcState(prev => ({
      ...prev,
      [opId]: { ...prev[opId], lines: updatedLines, result: { totalVol, totalWeight, freightOriginal, freightEur, ancillaryTotal, totalLandedEur, activeAncillary } }
    }))

    await load()
  }

  async function handleSetStatus(op, status) {
    try {
      await upsertLandedOperation({ ...op, status })
      setToast({ message: `Marked as ${status}`, type: 'success' })
      await load()
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  return (
    <div>
      <PageHeader title="LANDED Cost Calculator"
        action={<Btn onClick={openNewOp}><Plus size={15}/>New operation</Btn>} />

      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      : operations.length === 0 ? <EmptyState message="No operations yet — create one to start calculating landed costs" />
      : (
        <div className="space-y-3">
          {operations.map(op => {
            const isOpen = expanded === op.id
            const route = routes.find(r => r.id === op.route_id)
            const warehouse = warehouses.find(w => w.id === op.warehouse_id)
            const state = calcState[op.id]

            return (
              <div key={op.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => openOp(op)} className="text-gray-400 hover:text-gray-700">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{op.name}</span>
                    <span className="ml-3 text-xs text-gray-400">{op.operation_date}</span>
                    {route && <span className="ml-2 text-xs text-gray-400">{route.origin_country} · {route.origin_port} · {route.mode}</span>}
                    {warehouse && <span className="ml-2 text-xs text-gray-300">→ {warehouse.name}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[op.status]}`}>{op.status}</span>
                  {op.total_landed_eur && (
                    <span className="text-sm font-semibold text-slate-900 font-mono">
                      EUR {parseFloat(op.total_landed_eur).toFixed(2)} total
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{op.landed_operation_lines?.length || 0} products</span>
                  {op.status === 'draft' && (
                    <button onClick={() => handleSetStatus(op, 'confirmed')} title="Confirm"
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500"><CheckCircle size={15}/></button>
                  )}
                  {op.status === 'confirmed' && (
                    <button onClick={() => handleSetStatus(op, 'archived')} title="Archive"
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500"><Archive size={15}/></button>
                  )}
                  <button onClick={() => setConfirm(op.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 size={14}/></button>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-50 px-5 py-5 space-y-5">
                    {/* Add product */}
                    {op.status === 'draft' && (
                      <div className="flex gap-3 items-end bg-gray-50 rounded-xl p-4">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-medium text-gray-600">Add product</label>
                          <select value={state?.addingProduct || ''}
                            onChange={e => setCalcState(prev => ({ ...prev, [op.id]: { ...prev[op.id], addingProduct: e.target.value } }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                            <option value="">— select product —</option>
                            {products.filter(p => p.active).map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.weight_kg}kg · {p.length_cm}×{p.width_cm}×{p.height_cm}cm</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-24">
                          <label className="text-xs font-medium text-gray-600">Qty</label>
                          <input type="number" min="1" value={state?.addingQty || '1'}
                            onChange={e => setCalcState(prev => ({ ...prev, [op.id]: { ...prev[op.id], addingQty: e.target.value } }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <Btn onClick={() => handleAddLine(op.id)} disabled={saving}><Plus size={14}/>Add</Btn>
                      </div>
                    )}

                    {/* Products table */}
                    {state?.lines?.length > 0 && (
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wider">
                              <th className="text-left px-4 py-2.5">Product</th>
                              <th className="text-right px-3 py-2.5">Qty</th>
                              <th className="text-right px-3 py-2.5">Weight (kg)</th>
                              <th className="text-right px-3 py-2.5">Volume (m³)</th>
                              <th className="text-right px-3 py-2.5">Vol %</th>
                              <th className="text-right px-3 py-2.5">Freight EUR</th>
                              <th className="text-right px-3 py-2.5">Ancillary EUR</th>
                              <th className="text-right px-4 py-2.5 text-slate-700">Landed/unit EUR</th>
                              {op.status === 'draft' && <th className="px-3 py-2.5"/>}
                            </tr>
                          </thead>
                          <tbody>
                            {state.lines.map((l, i) => (
                              <tr key={l.id} className={`border-t border-gray-50 hover:bg-gray-50 ${i === state.lines.length - 1 ? '' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{l.product?.name}</div>
                                  <div className="text-xs text-gray-400">{l.product?.sku}</div>
                                </td>
                                <td className="px-3 py-3 text-right text-gray-600">{l.quantity}</td>
                                <td className="px-3 py-3 text-right font-mono text-gray-500 text-xs">{parseFloat(l.weight_kg).toFixed(3)}</td>
                                <td className="px-3 py-3 text-right font-mono text-gray-500 text-xs">{parseFloat(l.volume_m3).toFixed(6)}</td>
                                <td className="px-3 py-3 text-right text-gray-400 text-xs">{((parseFloat(l.volume_ratio) || 0) * 100).toFixed(1)}%</td>
                                <td className="px-3 py-3 text-right font-mono text-blue-600 text-xs">{parseFloat(l.freight_allocated_eur || 0).toFixed(4)}</td>
                                <td className="px-3 py-3 text-right font-mono text-violet-600 text-xs">{parseFloat(l.ancillary_allocated_eur || 0).toFixed(4)}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{parseFloat(l.total_landed_unit_eur || 0).toFixed(4)}</td>
                                {op.status === 'draft' && (
                                  <td className="px-3 py-3">
                                    <button onClick={() => handleDeleteLine(op.id, l.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 size={12}/></button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Summary */}
                    {(state?.result || op.total_landed_eur) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Total volume', value: `${parseFloat(state?.result?.totalVol || op.total_volume_m3 || 0).toFixed(4)} m³` },
                          { label: 'Total weight', value: `${parseFloat(state?.result?.totalWeight || op.total_weight_kg || 0).toFixed(3)} kg` },
                          { label: `Freight (${route?.currency || ''})`, value: parseFloat(state?.result?.freightOriginal || op.freight_cost_original || 0).toFixed(2), color: 'text-blue-700' },
                          { label: 'Freight EUR', value: parseFloat(state?.result?.freightEur || op.freight_cost_eur || 0).toFixed(2), color: 'text-blue-700' },
                          { label: 'Ancillary EUR', value: parseFloat(state?.result?.ancillaryTotal || op.ancillary_cost_eur || 0).toFixed(2), color: 'text-violet-700' },
                          { label: 'TOTAL LANDED EUR', value: parseFloat(state?.result?.totalLandedEur || op.total_landed_eur || 0).toFixed(2), color: 'text-slate-900', bold: true },
                        ].map(({ label, value, color = 'text-gray-700', bold }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">{label}</p>
                            <p className={`font-mono text-lg ${color} ${bold ? 'font-bold' : 'font-medium'}`}>{value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active ancillary costs applied */}
                    {state?.result?.activeAncillary?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Ancillary costs applied</p>
                        <div className="flex flex-wrap gap-2">
                          {state.result.activeAncillary.map(a => (
                            <span key={a.id} className="text-xs bg-violet-50 text-violet-700 px-3 py-1 rounded-lg">
                              {a.name}: {a.amount_tbc ? 'TBC' : `${a.currency} ${a.amount}`}
                            </span>
                          ))}
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

      {/* New Operation Modal */}
      <Modal open={opModal} onClose={() => setOpModal(false)} title="New LANDED operation" width="max-w-lg">
        <div className="space-y-4">
          <Input label="Operation name / reference *" value={opForm.name} onChange={e => setOpForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. China import Apr 2026" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Logistics route *</label>
            <select value={opForm.route_id} onChange={e => setOpForm(f => ({ ...f, route_id: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">— select route —</option>
              {routes.filter(r => r.active).map(r => (
                <option key={r.id} value={r.id}>
                  {r.logistics_partners?.name} · {r.origin_country} ({r.origin_port}) · {r.mode} · {r.load_unit} · {r.priority}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Destination warehouse</label>
            <select value={opForm.warehouse_id} onChange={e => setOpForm(f => ({ ...f, warehouse_id: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.country})</option>)}
            </select>
          </div>
          <Input label="Operation date" type="date" value={opForm.operation_date} onChange={e => setOpForm(f => ({ ...f, operation_date: e.target.value }))} />
          <Input label="Notes" value={opForm.notes} onChange={e => setOpForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setOpModal(false)}>Cancel</Btn>
          <Btn onClick={handleSaveOp} disabled={saving}>{saving ? 'Saving...' : 'Create operation'}</Btn>
        </div>
      </Modal>

      <Confirm open={!!confirm} message="Delete this operation and all its lines?"
        onConfirm={async () => {
          try { await deleteLandedOperation(confirm); setConfirm(null); setToast({ message: 'Deleted', type: 'success' }); await load() }
          catch { setToast({ message: 'Error', type: 'error' }) }
        }}
        onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
