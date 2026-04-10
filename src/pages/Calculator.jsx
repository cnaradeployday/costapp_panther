import { useEffect, useState, useCallback } from 'react'
import { getProducts, getPrintTechniques } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Btn, Select, EmptyState } from '../components/ui'
import { FileSpreadsheet, FileText, Calculator } from 'lucide-react'

function calcular(product, quantity, selectedTechniques) {
  if (!product || !quantity || quantity <= 0) return null

  // Landed unitario
  const fob = parseFloat(product.fob_price) || 0
  const landedAdditions = product.product_costs?.reduce((s, pc) =>
    s + (parseFloat(pc.quantity) * parseFloat(pc.cost_items?.value_per_unit ?? 0)), 0) ?? 0
  const landedUnit = fob + landedAdditions

  // Por cada técnica
  const techniques = selectedTechniques.map(tech => {
    const origCosts = tech.technique_costs?.filter(tc => tc.category === 'ORIGINATION') ?? []
    const hitCosts  = tech.technique_costs?.filter(tc => tc.category === 'HIT') ?? []

    const origTotal = origCosts.reduce((s, tc) =>
      s + (parseFloat(tc.quantity) * parseFloat(tc.cost_items?.value_per_unit ?? 0)), 0)
    const origUnit = origTotal / quantity

    const hitUnit = hitCosts.reduce((s, tc) =>
      s + (parseFloat(tc.quantity) * parseFloat(tc.cost_items?.value_per_unit ?? 0)), 0)

    return {
      id: tech.id,
      name: tech.name,
      origTotal,
      origUnit,
      hitUnit,
      total: origUnit + hitUnit,
      origCosts,
      hitCosts,
    }
  })

  const printTotal = techniques.reduce((s, t) => s + t.total, 0)
  const grandTotal = landedUnit + printTotal

  return { fob, landedAdditions, landedUnit, techniques, printTotal, grandTotal }
}

export default function CalculatorPage() {
  const { T, fmt, config } = useApp()
  const [products, setProducts] = useState([])
  const [techniques, setTechniques] = useState([])
  const [loading, setLoading] = useState(true)

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [selectedTechIds, setSelectedTechIds] = useState([])
  const [result, setResult] = useState(null)

  useEffect(() => {
    async function load() {
      const [prods, techs] = await Promise.all([getProducts(), getPrintTechniques()])
      setProducts(prods.filter(p => p.active))
      setTechniques(techs.filter(t => t.active))
      setLoading(false)
    }
    load()
  }, [])

  // Calcular en tiempo real cuando cambian los inputs
  useEffect(() => {
    const product = products.find(p => p.id === productId)
    const selTechs = techniques.filter(t => selectedTechIds.includes(t.id))
    const qty = parseFloat(quantity)
    if (product && qty > 0) {
      setResult(calcular(product, qty, selTechs))
    } else {
      setResult(null)
    }
  }, [productId, quantity, selectedTechIds, products, techniques])

  function toggleTech(id) {
    setSelectedTechIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx')
    const product = products.find(p => p.id === productId)
    if (!result) return

    const rows = [
      ['CALCULADORA DE COSTOS', '', ''],
      ['Empresa', config?.company_name, ''],
      ['Fecha', new Date().toLocaleDateString(), ''],
      ['', '', ''],
      ['PRODUCTO', product?.name, ''],
      ['SKU', product?.sku, ''],
      ['NCM', product?.ncm, ''],
      ['País origen', product?.origin_country, ''],
      ['Cantidad', parseFloat(quantity), 'unidades'],
      ['', '', ''],
      ['COSTO LANDED', '', ''],
      ['FOB unitario', result.fob, config?.currency_code],
      ...((product?.product_costs ?? []).map(pc => [
        pc.cost_items?.name, pc.quantity * pc.cost_items?.value_per_unit, config?.currency_code
      ])),
      ['TOTAL LANDED UNITARIO', result.landedUnit, config?.currency_code],
      ['', '', ''],
    ]

    result.techniques.forEach(tech => {
      rows.push([`TÉCNICA: ${tech.name}`, '', ''])
      rows.push(['Origination total', tech.origTotal, config?.currency_code])
      rows.push(['Origination prorrateado (÷ cantidad)', tech.origUnit, config?.currency_code])
      rows.push(['HIT unitario', tech.hitUnit, config?.currency_code])
      rows.push([`TOTAL TÉCNICA: ${tech.name}`, tech.total, config?.currency_code])
      rows.push(['', '', ''])
    })

    rows.push(['COSTO UNITARIO TOTAL', result.grandTotal, config?.currency_code])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Costo')
    XLSX.writeFile(wb, `costo_${product?.sku}_${quantity}u.xlsx`)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const product = products.find(p => p.id === productId)
    if (!result) return

    const doc = new jsPDF()
    const cur = config?.currency_code ?? ''

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Calculadora de costos', 14, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${config?.company_name} · ${new Date().toLocaleDateString()}`, 14, 28)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Producto', 14, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${product?.name} (${product?.sku}) · ${parseFloat(quantity)} unidades`, 14, 48)

    // Tabla Landed
    autoTable(doc, {
      startY: 56,
      head: [['Concepto', 'Importe']],
      body: [
        ['FOB unitario', `${cur} ${result.fob.toFixed(4)}`],
        ...((product?.product_costs ?? []).map(pc => [
          pc.cost_items?.name,
          `${cur} ${(pc.quantity * pc.cost_items?.value_per_unit).toFixed(4)}`
        ])),
        [{ content: 'Total landed unitario', styles: { fontStyle: 'bold' } },
         { content: `${cur} ${result.landedUnit.toFixed(4)}`, styles: { fontStyle: 'bold' } }],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 30, 30] },
    })

    result.techniques.forEach(tech => {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [[`Técnica: ${tech.name}`, '']],
        body: [
          ['Origination (total)', `${cur} ${tech.origTotal.toFixed(4)}`],
          ['Origination (prorrateado)', `${cur} ${tech.origUnit.toFixed(4)}`],
          ['HIT unitario', `${cur} ${tech.hitUnit.toFixed(4)}`],
          [{ content: `Total ${tech.name}`, styles: { fontStyle: 'bold' } },
           { content: `${cur} ${tech.total.toFixed(4)}`, styles: { fontStyle: 'bold' } }],
        ],
        theme: 'striped',
        headStyles: { fillColor: [60, 60, 60] },
      })
    })

    // Total final
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      body: [
        [{ content: 'COSTO UNITARIO TOTAL', styles: { fontStyle: 'bold', fontSize: 13 } },
         { content: `${cur} ${result.grandTotal.toFixed(4)}`, styles: { fontStyle: 'bold', fontSize: 13 } }],
      ],
      theme: 'plain',
    })

    doc.save(`costo_${product?.sku}_${quantity}u.pdf`)
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>

  const product = products.find(p => p.id === productId)

  return (
    <div className="max-w-3xl">
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
              <option value="">— seleccionar producto —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{T('quantity_units')}</label>
            <input type="number" min="1" step="1" value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Ej: 100"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
        </div>

        {/* Técnicas */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">{T('select_techniques')}</p>
          <div className="flex flex-wrap gap-2">
            {techniques.map(tech => (
              <button key={tech.id}
                onClick={() => toggleTech(tech.id)}
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

      {/* Resultado en tiempo real */}
      {result && (
        <div className="space-y-4">
          {/* Landed */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Costo Landed</h2>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-mono">
                {fmt(result.landedUnit)} / unidad
              </span>
            </div>
            <div className="px-6 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">FOB unitario</span>
                <span className="font-mono text-gray-700">{fmt(result.fob)}</span>
              </div>
              {product?.product_costs?.map(pc => (
                <div key={pc.id} className="flex justify-between text-sm">
                  <span className="text-gray-500">{pc.cost_items?.name}</span>
                  <span className="font-mono text-gray-700">{fmt(pc.quantity * pc.cost_items?.value_per_unit)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                <span className="text-gray-900">Total landed</span>
                <span className="font-mono text-gray-900">{fmt(result.landedUnit)}</span>
              </div>
            </div>
          </div>

          {/* Técnicas */}
          {result.techniques.map(tech => (
            <div key={tech.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{tech.name}</h2>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-mono">
                  {fmt(tech.total)} / unidad
                </span>
              </div>
              <div className="px-6 py-4 space-y-3">
                {/* Origination */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Origination</p>
                  {tech.origCosts.map((tc, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-500">{tc.cost_items?.name} ({tc.quantity} {tc.cost_items?.unit})</span>
                      <span className="font-mono text-gray-600">{fmt(tc.quantity * tc.cost_items?.value_per_unit)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>Total origination ÷ {parseFloat(quantity)} unidades</span>
                    <span className="font-mono">{fmt(tech.origUnit)}</span>
                  </div>
                </div>
                {/* HIT */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Hit</p>
                  {tech.hitCosts.map((tc, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-500">{tc.cost_items?.name} ({tc.quantity} {tc.cost_items?.unit})</span>
                      <span className="font-mono text-gray-600">{fmt(tc.quantity * tc.cost_items?.value_per_unit)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>Total HIT unitario</span>
                    <span className="font-mono">{fmt(tech.hitUnit)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                  <span>Total {tech.name}</span>
                  <span className="font-mono">{fmt(tech.total)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Total final */}
          <div className="bg-slate-900 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider">{T('result_grand_total')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{parseFloat(quantity)} unidades · {selectedTechIds.length} técnica(s)</p>
            </div>
            <span className="text-2xl font-semibold text-white font-mono">{fmt(result.grandTotal)}</span>
          </div>

          {/* Export */}
          <div className="flex gap-3 pt-2">
            <Btn variant="secondary" onClick={exportExcel}>
              <FileSpreadsheet size={15}/>{T('export_excel')}
            </Btn>
            <Btn variant="secondary" onClick={exportPDF}>
              <FileText size={15}/>{T('export_pdf')}
            </Btn>
          </div>
        </div>
      )}

      {!result && productId && parseFloat(quantity) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
          Seleccioná al menos un producto con cantidad para ver el cálculo
        </div>
      )}

      {!productId && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Seleccioná un producto y una cantidad para comenzar
        </div>
      )}
    </div>
  )
}
