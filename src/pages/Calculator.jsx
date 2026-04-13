import { useEffect, useState } from 'react'
import { getProducts, getPrintTechniques, getMarginTiers, getQtyBreaks } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Calculator, FileSpreadsheet, FileText, Plus, X } from 'lucide-react'

function getMargin(tiers, totalOrderValue) {
  if (!tiers?.length) return 0
  const tier = tiers.find(t =>
    totalOrderValue >= parseFloat(t.qty_from) &&
    (t.qty_to === null || totalOrderValue <= parseFloat(t.qty_to))
  )
  return tier ? parseFloat(tier.margin_pct) : 0
}

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

function calcPrintUnit(tech, qty) {
  const origCosts = tech.technique_costs?.filter(tc => tc.category === 'ORIGINATION') ?? []
  const hitCosts  = tech.technique_costs?.filter(tc => tc.category === 'HIT') ?? []

  const origTotal = origCosts.reduce((s, tc) => {
    const val = (tc.value_override !== null && tc.value_override !== undefined)
      ? parseFloat(tc.value_override)
      : parseFloat(tc.cost_items?.value_per_unit ?? 0)
    return s + val * parseFloat(tc.quantity)
  }, 0)

  const hitUnit = hitCosts.reduce((s, tc) => {
    const val = (tc.value_override !== null && tc.value_override !== undefined)
      ? parseFloat(tc.value_override)
      : parseFloat(tc.cost_items?.value_per_unit ?? 0)
    return s + val * parseFloat(tc.quantity)
  }, 0)

  return {
    id: tech.id, name: tech.name,
    origTotal,
    origUnit: origTotal / qty,
    hitUnit,
    total: origTotal / qty + hitUnit
  }
}

export default function CalculatorPage() {
  const { T, fmt, config } = useApp()
  const [products, setProducts] = useState([])
  const [techniques, setTechniques] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [selectedTechIds, setSelectedTechIds] = useState([])
  const [activeBreaks, setActiveBreaks] = useState([])
  const [newBreakQty, setNewBreakQty] = useState('')

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

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function toggleTech(id) {
    setSelectedTechIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function addBreak() {
    const qty = parseInt(newBreakQty)
    if (!qty || qty <= 0 || activeBreaks.includes(qty)) return
    setActiveBreaks(prev => [...prev, qty].sort((a, b) => a - b))
    setNewBreakQty('')
  }
  function removeBreak(qty) { setActiveBreaks(prev => prev.filter(q => q !== qty)) }

  const product = products.find(p => p.id === productId)
  const selTechs = techniques.filter(t => selectedTechIds.includes(t.id))

  const rows = product ? activeBreaks.map(qty => {
    const { fob, additions, landedUnit } = calcLandedUnit(product)
    const techs = selTechs.map(t => calcPrintUnit(t, qty))
    const printTotal = techs.reduce((s, t) => s + t.total, 0)
    const costUnit = landedUnit + printTotal
    const costTotal = costUnit * qty
    const totalOrderValue = costTotal
    const marginPct = getMargin(tiers, totalOrderValue)
    const sellUnit = marginPct > 0 ? costUnit / (1 - marginPct / 100) : costUnit
    const sellTotal = sellUnit * qty
    return { qty, fob, additions, landedUnit, techs, printTotal, costUnit, costTotal, totalOrderValue, marginPct, sellUnit, sellTotal }
  }) : []

  async function exportExcel() {
    if (!product || !rows.length) return
    const { default: XLSX } = await import('xlsx')
    const cur = config?.currency_code ?? ''

    const techHeaders = selTechs.flatMap(t => [`${t.name} Orig.`, `${t.name} HIT`])
    const headers = [
      'QTY', 'FOB', 'Landed',
      ...techHeaders,
      'Cost unit', 'Cost total', 'Margin %', 'Sell unit', 'Sell total'
    ]

    const data = rows.map(r => [
      r.qty,
      r.fob.toFixed(4),
      r.landedUnit.toFixed(4),
      ...r.techs.flatMap(t => [t.origUnit.toFixed(4), t.hitUnit.toFixed(4)]),
      r.costUnit.toFixed(4),
      r.costTotal.toFixed(2),
      r.marginPct + '%',
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
  }

  async function exportPDF() {
    if (!product || !rows.length) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const cur = config?.currency_code ?? ''
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(`${product.name} — Qty Breaks`, 14, 18)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`${config?.company_name} · ${new Date().toLocaleDateString()}`, 14, 26)

    const techHeaders = selTechs.flatMap(t => [`${t.name} Orig.`, `${t.name} HIT`])

    autoTable(doc, {
      startY: 32,
      head: [['QTY', 'FOB', 'Landed', ...techHeaders, 'Cost unit', 'Cost total', 'Margin', 'Sell unit', 'Sell total']],
      body: rows.map(r => [
        r.qty,
        `${cur} ${r.fob.toFixed(4)}`,
        `${cur} ${r.landedUnit.toFixed(4)}`,
        ...r.techs.flatMap(t => [`${cur} ${t.origUnit.toFixed(4)}`, `${cur} ${t.hitUnit.toFixed(4)}`]),
        `${cur} ${r.costUnit.toFixed(4)}`,
        `${cur} ${r.costTotal.toFixed(2)}`,
        `${r.marginPct}%`,
        `${cur} ${r.sellUnit.toFixed(4)}`,
        `${cur} ${r.sellTotal.toFixed(2)}`,
      ]),
      headStyles: { fillColor: [30, 30, 30] },
      theme: 'striped',
    })
    doc.save(`qtybreaks_${product.sku}.pdf`)
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
            <select value={productId} onChange={e => setProductId(e.target.value)}
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
          <p className="text-xs font-medium text-gray-600 mb-2">{T('select_techniques')}</p>
          <div className="flex flex-wrap gap-2">
            {techniques.map(tech => (
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
              <p className="text-xs text-gray-400 mt-0.5">Margin applied based on total order value</p>
            </div>
            <div className="flex gap-2">
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
                  <th className="text-right px-4 py-3">QTY</th>
                  <th className="text-right px-3 py-3">FOB</th>
                  <th className="text-right px-3 py-3">Landed</th>
                  {selTechs.map(t => (
                    <>
                      <th key={`${t.id}-orig`} className="text-right px-3 py-3 text-amber-500">{t.name} Orig.</th>
                      <th key={`${t.id}-hit`}  className="text-right px-3 py-3 text-emerald-500">{t.name} HIT</th>
                    </>
                  ))}
                  <th className="text-right px-3 py-3">Cost unit</th>
                  <th className="text-right px-3 py-3">Cost total</th>
                  <th className="text-right px-3 py-3">Margin</th>
                  <th className="text-right px-3 py-3">Sell unit</th>
                  <th className="text-right px-4 py-3 text-slate-900">Sell total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.qty} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === rows.length - 1 ? 'border-0' : ''}`}>
                    <td className="text-right px-4 py-3 font-semibold text-gray-900">{r.qty.toLocaleString()}</td>
                    <td className="text-right px-3 py-3 font-mono text-gray-400 text-xs">{fmt(r.fob)}</td>
                    <td className="text-right px-3 py-3 font-mono text-blue-600 text-xs">{fmt(r.landedUnit)}</td>
                    {r.techs.map(t => (
                      <>
                        <td key={`${t.id}-orig`} className="text-right px-3 py-3 font-mono text-amber-600 text-xs">{fmt(t.origUnit)}</td>
                        <td key={`${t.id}-hit`}  className="text-right px-3 py-3 font-mono text-emerald-600 text-xs">{fmt(t.hitUnit)}</td>
                      </>
                    ))}
                    <td className="text-right px-3 py-3 font-mono text-gray-700 text-xs font-semibold">{fmt(r.costUnit)}</td>
                    <td className="text-right px-3 py-3 font-mono text-gray-500 text-xs">{fmt(r.costTotal)}</td>
                    <td className="text-right px-3 py-3">
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-medium">{r.marginPct}%</span>
                    </td>
                    <td className="text-right px-3 py-3 font-mono text-gray-700 text-xs">{fmt(r.sellUnit)}</td>
                    <td className="text-right px-4 py-3 font-mono font-semibold text-slate-900">{fmt(r.sellTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tiers.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-50 flex flex-wrap gap-4 items-center">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Margin tiers:</span>
              {tiers.map(t => (
                <span key={t.id} className="text-xs text-gray-400">
                  {config?.currency_symbol}{parseFloat(t.qty_from).toLocaleString()}–{t.qty_to ? `${config?.currency_symbol}${parseFloat(t.qty_to).toLocaleString()}` : '∞'}
                  {' → '}<span className="font-medium text-gray-600">{t.margin_pct}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!product && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a product to see qty breaks and pricing
        </div>
      )}
    </div>
  )
}
