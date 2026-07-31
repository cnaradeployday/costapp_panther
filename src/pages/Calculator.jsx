import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { getProducts, getPrintTechniques, getMarginTiers, getQtyBreaks } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { lineTotal, defaultMarkupPct, effectiveMarkupPct, sellPrice, costType } from '../lib/techniqueCosts'
import { Toast } from '../components/ui'
import { Calculator, FileSpreadsheet, FileText, Plus, X, ChevronUp, ChevronDown, GripVertical, Columns3 } from 'lucide-react'

const COL_ORDER_KEY = 'calcColOrder'
const COL_HIDDEN_KEY = 'calcHiddenCols'

function calcLandedUnit(product) {
  const fob = parseFloat(product.fob_price) || 0
  const additions = product.product_costs?.reduce((s, pc) => {
    const ci = pc.cost_items
    if (!ci) return s
    const val = (pc.value_override !== null && pc.value_override !== undefined)
      ? parseFloat(pc.value_override)
      : parseFloat(ci.value_per_unit)
    if (ci.value_type === 'percentage_of_fob') return s + (val / 100) * fob
    return s + val * parseFloat(pc.quantity)
  }, 0) ?? 0
  return { fob, additions, landedUnit: fob + additions }
}

// FIX costs (Origination, QC_PRINT) are a one-off charge amortized over qty;
// UNIT costs (HIT) are already a per-piece cost — no amortization needed.
function lineUnitCost(tc, qty) {
  const total = lineTotal(tc)
  return tc.category === 'HIT' ? total : total / qty
}

// Each technique cost line carries its own markup (defaulting to the company's
// general markup when not overridden) — sell price is built up line by line,
// and every line stays visible instead of being collapsed into ORIG/HIT sums,
// so the cost breakdown shown here always matches the lines set up in Techniques.
function calcPrintUnit(tech, qty, tiers) {
  const costLines = tech.technique_costs ?? []

  const lines = costLines.map(tc => {
    const unitCost = lineUnitCost(tc, qty)
    const markupPct = effectiveMarkupPct(tc, tiers)
    return {
      id: tc.id,
      name: tc.cost_items?.name ?? '—',
      category: tc.category,
      unitCost,
      sellUnit: sellPrice(unitCost, markupPct),
      markupPct,
    }
  })

  const total = lines.reduce((s, l) => s + l.unitCost, 0)
  const sellUnit = lines.reduce((s, l) => s + l.sellUnit, 0)

  return { id: tech.id, name: tech.name, lines, total, sellUnit }
}

export default function CalculatorPage() {
  const { T, fmt, config, tabVisible } = useApp()
  const [products, setProducts] = useState([])
  const [techniques, setTechniques] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [selectedTechIds, setSelectedTechIds] = useState([])
  const [activeBreaks, setActiveBreaks] = useState([])
  const [newBreakQty, setNewBreakQty] = useState('')
  const [toast, setToast] = useState(null)
  const [colOrder, setColOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COL_ORDER_KEY)) ?? [] } catch { return [] }
  })
  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COL_HIDDEN_KEY)) ?? [] } catch { return [] }
  })
  const [dragColKey, setDragColKey] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [showColMenu, setShowColMenu] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [prods, techs, trs, brks] = await Promise.all([
        getProducts(), getPrintTechniques(), getMarginTiers(), getQtyBreaks()
      ])
      setProducts(prods.filter(p => p.active))
      setTechniques(techs.filter(t => t.active))
      setTiers(trs)
      setActiveBreaks(brks.map(b => b.quantity))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function toggleTech(id) {
    setSelectedTechIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function selectProduct(id) {
    setProductId(id)
    const p = products.find(x => x.id === id)
    const allowed = p?.technique_ids?.length ? p.technique_ids : null
    if (allowed) setSelectedTechIds(prev => prev.filter(x => allowed.includes(x)))
  }
  function addBreak() {
    const qty = parseInt(newBreakQty)
    if (!qty || qty <= 0 || activeBreaks.includes(qty)) return
    setActiveBreaks(prev => [...prev, qty].sort((a, b) => a - b))
    setNewBreakQty('')
  }
  function removeBreak(qty) { setActiveBreaks(prev => prev.filter(q => q !== qty)) }

  const product = products.find(p => p.id === productId)
  const availableTechs = product?.technique_ids?.length
    ? techniques.filter(t => product.technique_ids.includes(t.id))
    : techniques
  const selTechs = availableTechs.filter(t => selectedTechIds.includes(t.id))
  const lineHeaders = selTechs.flatMap(t => (t.technique_costs ?? []).map(tc =>
    selTechs.length > 1 ? `${t.name} — ${tc.cost_items?.name ?? '—'}` : (tc.cost_items?.name ?? '—')
  ))

  const rows = product ? activeBreaks.map(qty => {
    const { fob, additions, landedUnit } = calcLandedUnit(product)
    const techs = selTechs.map(t => calcPrintUnit(t, qty, tiers))
    const printTotal = techs.reduce((s, t) => s + t.total, 0)
    const printSellTotal = techs.reduce((s, t) => s + t.sellUnit, 0)
    const costUnit = landedUnit + printTotal
    const costTotal = costUnit * qty
    const landedSellUnit = sellPrice(landedUnit, defaultMarkupPct(tiers))
    const sellUnit = landedSellUnit + printSellTotal
    const sellTotal = sellUnit * qty
    const markupPct = costUnit > 0 ? ((sellUnit - costUnit) / costUnit) * 100 : 0
    return { qty, fob, additions, landedUnit, techs, printTotal, costUnit, costTotal, markupPct, sellUnit, sellTotal }
  }) : []

  // Column set depends on which techniques/cost lines are selected, so it's rebuilt
  // whenever that changes; user-chosen order/visibility (by key) survives that.
  const columns = [
    { key: 'qty', label: 'QTY', get: r => r.qty, format: v => v.toLocaleString(), cellClass: 'font-semibold text-gray-900' },
    { key: 'fob', label: 'FOB', get: r => r.fob, format: fmt, cellClass: 'font-mono text-gray-400 text-xs' },
    { key: 'landed', label: 'Landed', get: r => r.landedUnit, format: fmt, cellClass: 'font-mono text-blue-600 text-xs' },
    ...selTechs.flatMap(t => (t.technique_costs ?? []).map(tc => ({
      key: `line_${tc.id}`,
      label: (selTechs.length > 1 ? `${t.name} — ` : '') + (tc.cost_items?.name ?? '—'),
      get: r => r.techs.find(rt => rt.id === t.id)?.lines.find(l => l.id === tc.id)?.unitCost ?? 0,
      format: fmt,
      headerClass: costType(tc.category) === 'FIX' ? 'text-amber-500' : 'text-emerald-500',
      cellClass: `font-mono text-xs ${costType(tc.category) === 'FIX' ? 'text-amber-600' : 'text-emerald-600'}`,
    }))),
    { key: 'costUnit', label: 'Cost unit', get: r => r.costUnit, format: fmt, cellClass: 'font-mono text-gray-700 text-xs font-semibold' },
    { key: 'costTotal', label: 'Cost total', get: r => r.costTotal, format: fmt, cellClass: 'font-mono text-gray-500 text-xs' },
    { key: 'markup', label: 'Markup', get: r => r.markupPct, format: v => v.toFixed(1) + '%', isBadge: true },
    { key: 'sellUnit', label: 'Sell unit', get: r => r.sellUnit, format: fmt, cellClass: 'font-mono text-gray-700 text-xs' },
    { key: 'sellTotal', label: 'Sell total', get: r => r.sellTotal, format: fmt, cellClass: 'font-mono font-semibold text-slate-900' },
  ]
  const colByKey = Object.fromEntries(columns.map(c => [c.key, c]))
  const orderedKeys = [
    ...colOrder.filter(k => colByKey[k]),
    ...columns.map(c => c.key).filter(k => !colOrder.includes(k)),
  ]
  const visibleColumns = orderedKeys.map(k => colByKey[k]).filter(c => !hiddenCols.includes(c.key))

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => ((colByKey[sortKey]?.get(a) ?? 0) - (colByKey[sortKey]?.get(b) ?? 0)) * (sortDir === 'asc' ? 1 : -1))
    : rows

  function persistColOrder(order) {
    setColOrder(order)
    localStorage.setItem(COL_ORDER_KEY, JSON.stringify(order))
  }
  function toggleColHidden(key) {
    setHiddenCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(COL_HIDDEN_KEY, JSON.stringify(next))
      return next
    })
  }
  function handleColDrop(targetKey) {
    if (!dragColKey || dragColKey === targetKey) { setDragColKey(null); return }
    const keys = orderedKeys.filter(k => k !== dragColKey)
    const targetIdx = keys.indexOf(targetKey)
    keys.splice(targetIdx, 0, dragColKey)
    persistColOrder(keys)
    setDragColKey(null)
  }
  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  async function exportExcel() {
    if (!product || !rows.length) return
    try {
      const cur = config?.currency_code ?? ''

      const headers = [
        'QTY', 'FOB', 'Landed',
        ...lineHeaders,
        'Cost unit', 'Cost total', 'Markup %', 'Sell unit', 'Sell total'
      ]

      const data = rows.map(r => [
        r.qty,
        r.fob.toFixed(4),
        r.landedUnit.toFixed(4),
        ...r.techs.flatMap(t => t.lines.map(l => l.unitCost.toFixed(4))),
        r.costUnit.toFixed(4),
        r.costTotal.toFixed(2),
        r.markupPct.toFixed(1) + '%',
        r.sellUnit.toFixed(4),
        r.sellTotal.toFixed(2),
      ])

      const ws = XLSX.utils.aoa_to_sheet([
        [`${product.name} (${product.sku}) — Qty breaks`],
        [`Currency: ${cur}`], [],
        headers,
        ...data
      ])
      ws['!cols'] = headers.map(() => ({ wch: 14 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Qty Breaks')
      XLSX.writeFile(wb, `qtybreaks_${product.sku}.xlsx`)
    } catch (e) {
      console.error('Excel export error:', e)
      setToast({ message: 'Could not export to Excel — try reloading the page', type: 'error' })
    }
  }

  async function exportPDF() {
    if (!product || !rows.length) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const cur = config?.currency_code ?? ''
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(16); doc.setFont('helvetica', 'bold')
      doc.text(`${product.name} — Qty Breaks`, 14, 18)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      doc.text(`${config?.company_name} · ${new Date().toLocaleDateString()}`, 14, 26)

      autoTable(doc, {
        startY: 32,
        head: [['QTY', 'FOB', 'Landed', ...lineHeaders, 'Cost unit', 'Cost total', 'Markup', 'Sell unit', 'Sell total']],
        body: rows.map(r => [
          r.qty,
          `${cur} ${r.fob.toFixed(4)}`,
          `${cur} ${r.landedUnit.toFixed(4)}`,
          ...r.techs.flatMap(t => t.lines.map(l => `${cur} ${l.unitCost.toFixed(4)}`)),
          `${cur} ${r.costUnit.toFixed(4)}`,
          `${cur} ${r.costTotal.toFixed(2)}`,
          `${r.markupPct.toFixed(1)}%`,
          `${cur} ${r.sellUnit.toFixed(4)}`,
          `${cur} ${r.sellTotal.toFixed(2)}`,
        ]),
        headStyles: { fillColor: [30, 30, 30] },
        theme: 'striped',
      })
      doc.save(`qtybreaks_${product.sku}.pdf`)
    } catch (e) {
      console.error('PDF export error:', e)
      setToast({ message: 'Could not export to PDF — try reloading the page', type: 'error' })
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-7">
        <Calculator size={22} className="text-gray-400" />
        <h1 className="text-2xl font-semibold text-gray-900">{T('calculator_title')}</h1>
      </div>

      {/* Inputs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{T('select_product')}</label>
            <select value={productId} onChange={e => selectProduct(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
              <option value="">— select product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Qty breaks</label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[42px]">
              {activeBreaks.map(qty => (
                <span key={qty} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-lg">
                  {qty.toLocaleString()}
                  <button onClick={() => removeBreak(qty)} className="text-slate-400 hover:text-slate-700"><X size={10}/></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input type="number" value={newBreakQty} onChange={e => setNewBreakQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBreak()}
                  placeholder="add..." className="w-16 text-xs border-0 focus:outline-none bg-transparent text-gray-500" />
                <button onClick={addBreak} className="text-slate-400 hover:text-slate-700"><Plus size={12}/></button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">
            {T('select_techniques')}
            {product?.technique_ids?.length > 0 && (
              <span className="text-gray-400 font-normal ml-1">(filtered for {product.name})</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTechs.length === 0 && (
              <span className="text-xs text-gray-400">No techniques enabled for this product</span>
            )}
            {availableTechs.map(tech => (
              <button key={tech.id} onClick={() => toggleTech(tech.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedTechIds.includes(tech.id)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-slate-400'
                }`}>
                {tech.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      {product && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {product.name} <span className="text-gray-400 font-normal text-xs ml-1">{product.sku}</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Markup applied per cost line (set in Techniques → Markup %)</p>
            </div>
            <div className="flex gap-2 relative">
              <button onClick={() => setShowColMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                <Columns3 size={13}/> Columns
              </button>
              {showColMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
                  <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 w-56 max-h-72 overflow-y-auto">
                    {columns.map(c => (
                      <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={!hiddenCols.includes(c.key)} onChange={() => toggleColHidden(c.key)} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
              <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                <FileSpreadsheet size={13}/> Excel
              </button>
              <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                <FileText size={13}/> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                  {visibleColumns.map(c => (
                    <th key={c.key}
                      draggable
                      onDragStart={() => setDragColKey(c.key)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleColDrop(c.key)}
                      onClick={() => toggleSort(c.key)}
                      className={`text-right px-3 py-3 cursor-pointer select-none hover:text-gray-600 ${c.headerClass ?? ''} ${dragColKey === c.key ? 'opacity-40' : ''}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        <GripVertical size={11} className="text-gray-300"/>
                        {c.label}
                        {sortKey === c.key && (sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => (
                  <tr key={r.qty} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === sortedRows.length - 1 ? 'border-0' : ''}`}>
                    {visibleColumns.map(c => (
                      <td key={c.key} className={`text-right px-3 py-3 ${c.cellClass ?? ''}`}>
                        {c.isBadge
                          ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-medium">{c.format(c.get(r))}</span>
                          : c.format(c.get(r))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!product && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a product to see qty breaks and pricing
        </div>
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
