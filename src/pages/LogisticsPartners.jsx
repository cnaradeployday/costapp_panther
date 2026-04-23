import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Truck } from 'lucide-react'
import {
  getLogisticsPartners, upsertLogisticsPartner, deleteLogisticsPartner,
  getLogisticsRoutes, upsertLogisticsRoute, deleteLogisticsRoute,
  upsertPriceTier, deletePriceTier,
  getAncillaryCosts, upsertAncillaryCost, deleteAncillaryCost
} from '../lib/landed'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Select, Toggle, PageHeader, EmptyState, SearchInput } from '../components/ui'

const MODES = ['By Sea', 'By Air', 'By Road', 'By Train']
const PRIORITIES = ['Default (1st Choice)', '2nd Choice', '3rd Choice', 'Back up Only']
const LOAD_UNITS = ["20' Container (Own)", "40' Container (Own)", "40'HC Container (Own)", 'Container (LCL-Groupage)', 'Cartons', 'Pallets']
const COST_MEASUREMENTS = ['Per Container', 'Per Cubic Meter', 'Kilo', 'Per Carton', 'Per Pallet']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'STG']

const emptyPartner = { erp_code: '', name: '', currency: 'USD', hazardous_goods: 'No', active: true, notes: '' }
const emptyRoute = { origin_country: '', origin_port: '', mode: 'By Sea', load_unit: "40' Container (Own)", priority: 'Default (1st Choice)', transit_days: '', cost_measurement: 'Per Container', pricing_type: 'Unit', unit_cost: '', currency: 'USD', valid_from: '', valid_to: '', eu_customs_required: false, active: true }
const emptyAncillary = { name: '', amount: '', amount_tbc: false, currency: 'EUR', per_unit: true, eu_exempt: false, valid_from: '', valid_to: '', active: true, notes: '' }

export default function LogisticsPartnersPage() {
  const { tabVisible } = useApp()
  const [partners, setPartners] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [expandedTab, setExpandedTab] = useState({}) // partnerId -> 'routes' | 'ancillary'

  const [partnerModal, setPartnerModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState(null)
  const [partnerForm, setPartnerForm] = useState(emptyPartner)

  const [routeModal, setRouteModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [routeForm, setRouteForm] = useState(emptyRoute)
  const [activePartnerId, setActivePartnerId] = useState(null)

  const [ancillaryModal, setAncillaryModal] = useState(false)
  const [editingAncillary, setEditingAncillary] = useState(null)
  const [ancillaryForm, setAncillaryForm] = useState(emptyAncillary)
  const [ancillaryList, setAncillaryList] = useState([])

  const [priceTiers, setPriceTiers] = useState([]) // for route being edited
  const [newTier, setNewTier] = useState({ qty_from: '', qty_to: '', price: '' })

  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [p, r] = await Promise.all([getLogisticsPartners(), getLogisticsRoutes()])
      setPartners(p); setRoutes(r)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  // Partner CRUD
  function openNewPartner() { setEditingPartner(null); setPartnerForm(emptyPartner); setPartnerModal(true) }
  function openEditPartner(p) { setEditingPartner(p); setPartnerForm({ ...p }); setPartnerModal(true) }
  async function handleSavePartner() {
    if (!partnerForm.erp_code || !partnerForm.name) return
    setSaving(true)
    try {
      await upsertLogisticsPartner({ ...(editingPartner ? { id: editingPartner.id } : {}), ...partnerForm })
      setPartnerModal(false); setToast({ message: 'Saved', type: 'success' }); await load()
    } catch { setToast({ message: 'Error', type: 'error' }) } finally { setSaving(false) }
  }

  // Route CRUD
  function openNewRoute(partnerId) {
    setActivePartnerId(partnerId); setEditingRoute(null)
    setRouteForm({ ...emptyRoute }); setPriceTiers([]); setRouteModal(true)
  }
  function openEditRoute(r) {
    setActivePartnerId(r.partner_id); setEditingRoute(r)
    setRouteForm({ ...r, transit_days: String(r.transit_days), unit_cost: r.unit_cost ? String(r.unit_cost) : '' })
    setPriceTiers(r.logistics_price_tiers || []); setRouteModal(true)
  }
  async function handleSaveRoute() {
    if (!routeForm.origin_country || !routeForm.mode) return
    setSaving(true)
    try {
      const saved = await upsertLogisticsRoute({
        ...(editingRoute ? { id: editingRoute.id } : {}),
        ...routeForm,
        partner_id: activePartnerId,
        transit_days: parseInt(routeForm.transit_days) || 0,
        unit_cost: routeForm.pricing_type === 'Unit' ? parseFloat(routeForm.unit_cost) || null : null,
      })
      // Save price tiers
      for (const t of priceTiers.filter(t => !t.id)) {
        await upsertPriceTier({ ...t, route_id: saved.id })
      }
      setRouteModal(false); setToast({ message: 'Saved', type: 'success' }); await load()
    } catch { setToast({ message: 'Error', type: 'error' }) } finally { setSaving(false) }
  }
  async function handleDeleteRoute(id) {
    try { await deleteLogisticsRoute(id); setConfirm(null); setToast({ message: 'Deleted', type: 'success' }); await load() }
    catch { setToast({ message: 'Error', type: 'error' }) }
  }

  // Ancillary CRUD
  async function openAncillarySection(partnerId) {
    setActivePartnerId(partnerId)
    const list = await getAncillaryCosts(partnerId)
    setAncillaryList(list)
  }
  function openNewAncillary(partnerId) {
    setActivePartnerId(partnerId); setEditingAncillary(null)
    setAncillaryForm({ ...emptyAncillary }); setAncillaryModal(true)
  }
  function openEditAncillary(a) {
    setEditingAncillary(a)
    setAncillaryForm({ ...a, amount: a.amount ? String(a.amount) : '' }); setAncillaryModal(true)
  }
  async function handleSaveAncillary() {
    if (!ancillaryForm.name) return
    setSaving(true)
    try {
      await upsertAncillaryCost({
        ...(editingAncillary ? { id: editingAncillary.id } : {}),
        ...ancillaryForm,
        partner_id: activePartnerId,
        amount: ancillaryForm.amount_tbc ? null : parseFloat(ancillaryForm.amount) || null,
      })
      setAncillaryModal(false); setToast({ message: 'Saved', type: 'success' })
      await openAncillarySection(activePartnerId)
    } catch { setToast({ message: 'Error', type: 'error' }) } finally { setSaving(false) }
  }
  async function handleDeleteAncillary(id) {
    try {
      await deleteAncillaryCost(id); setConfirm(null); setToast({ message: 'Deleted', type: 'success' })
      await openAncillarySection(activePartnerId)
    } catch { setToast({ message: 'Error', type: 'error' }) }
  }

  const filtered = partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.erp_code.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <PageHeader title="Logistics Partners"
        action={<Btn onClick={openNewPartner}><Plus size={15}/>New partner</Btn>} />

      <div className="mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search partners..." />
      </div>

      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      : filtered.length === 0 ? <EmptyState message="No logistics partners" />
      : (
        <div className="space-y-3">
          {filtered.map(partner => {
            const isOpen = expanded === partner.id
            const partnerRoutes = routes.filter(r => r.partner_id === partner.id)
            const tab = expandedTab[partner.id] || 'routes'
            return (
              <div key={partner.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => {
                    setExpanded(isOpen ? null : partner.id)
                    if (!isOpen) openAncillarySection(partner.id)
                  }} className="text-gray-400 hover:text-gray-700">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <Truck size={15} className="text-gray-300"/>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{partner.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{partner.erp_code}</span>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">{partner.currency}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${partner.hazardous_goods === 'Yes' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                    Haz: {partner.hazardous_goods}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${partner.active ? 'bg-emerald-400' : 'bg-gray-300'}`}/>
                  <span className="text-xs text-gray-400">{partnerRoutes.length} route{partnerRoutes.length !== 1 ? 's' : ''}</span>
                  <button onClick={() => openEditPartner(partner)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil size={14}/></button>
                  <button onClick={() => setConfirm({ type: 'partner', id: partner.id })} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 px-5">
                      {['routes', 'ancillary'].map(t => (
                        <button key={t} onClick={() => setExpandedTab(prev => ({ ...prev, [partner.id]: t }))}
                          className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                          {t === 'routes' ? `Routes (${partnerRoutes.length})` : 'Ancillary Costs'}
                        </button>
                      ))}
                    </div>

                    {tab === 'routes' && (
                      <div className="px-5 py-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Routes</p>
                          <Btn size="sm" variant="secondary" onClick={() => openNewRoute(partner.id)}><Plus size={12}/>Add route</Btn>
                        </div>
                        {partnerRoutes.length === 0 ? <p className="text-sm text-gray-400 py-2">No routes configured</p> : (
                          <div className="space-y-2">
                            {partnerRoutes.map(r => (
                              <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-800">{r.origin_country} · {r.origin_port}</span>
                                  <span className="ml-2 text-xs text-gray-400">{r.mode} · {r.load_unit}</span>
                                </div>
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg">{r.priority}</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {r.pricing_type === 'Unit' ? `${r.currency} ${r.unit_cost}` : 'Price table'}
                                  <span className="text-gray-400"> / {r.cost_measurement}</span>
                                </span>
                                <span className="text-xs text-gray-400">{r.transit_days}d</span>
                                <span className={`w-2 h-2 rounded-full ${r.active ? 'bg-emerald-400' : 'bg-gray-300'}`}/>
                                <button onClick={() => openEditRoute(r)} className="p-1 rounded hover:bg-gray-200 text-gray-400"><Pencil size={13}/></button>
                                <button onClick={() => setConfirm({ type: 'route', id: r.id })} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {tab === 'ancillary' && (
                      <div className="px-5 py-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ancillary Costs</p>
                          <Btn size="sm" variant="secondary" onClick={() => openNewAncillary(partner.id)}><Plus size={12}/>Add cost</Btn>
                        </div>
                        {ancillaryList.filter(a => a.partner_id === partner.id).length === 0
                          ? <p className="text-sm text-gray-400 py-2">No ancillary costs</p>
                          : (
                            <div className="space-y-2">
                              {ancillaryList.filter(a => a.partner_id === partner.id).map(a => (
                                <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                                  <span className="flex-1 text-sm text-gray-700">{a.name}</span>
                                  {a.load_units?.length > 0 && (
                                    <span className="text-xs text-gray-400">{a.load_units.join(', ')}</span>
                                  )}
                                  <span className="text-sm font-mono font-medium text-gray-800">
                                    {a.amount_tbc ? 'TBC' : `${a.currency} ${a.amount}`}
                                  </span>
                                  {a.eu_exempt && <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-lg">EU exempt</span>}
                                  <span className={`w-2 h-2 rounded-full ${a.active ? 'bg-emerald-400' : 'bg-gray-300'}`}/>
                                  <button onClick={() => openEditAncillary(a)} className="p-1 rounded hover:bg-gray-200 text-gray-400"><Pencil size={13}/></button>
                                  <button onClick={() => setConfirm({ type: 'ancillary', id: a.id })} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                                </div>
                              ))}
                            </div>
                          )
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Partner Modal */}
      <Modal open={partnerModal} onClose={() => setPartnerModal(false)} title={editingPartner ? 'Edit partner' : 'New logistics partner'} width="max-w-md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="ERP Code *" value={partnerForm.erp_code} onChange={e => setPartnerForm(f => ({ ...f, erp_code: e.target.value.toUpperCase() }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Currency</label>
              <select value={partnerForm.currency} onChange={e => setPartnerForm(f => ({ ...f, currency: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Input label="Name *" value={partnerForm.name} onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Hazardous goods</label>
            <select value={partnerForm.hazardous_goods} onChange={e => setPartnerForm(f => ({ ...f, hazardous_goods: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              {['Yes', 'No', 'tbc'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <Input label="Notes" value={partnerForm.notes || ''} onChange={e => setPartnerForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex items-center gap-3">
            <Toggle checked={partnerForm.active} onChange={v => setPartnerForm(f => ({ ...f, active: v }))} />
            <span className="text-sm text-gray-600">Active</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setPartnerModal(false)}>Cancel</Btn>
          <Btn onClick={handleSavePartner} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
        </div>
      </Modal>

      {/* Route Modal */}
      <Modal open={routeModal} onClose={() => setRouteModal(false)} title={editingRoute ? 'Edit route' : 'New route'} width="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Origin country *" value={routeForm.origin_country} onChange={e => setRouteForm(f => ({ ...f, origin_country: e.target.value }))} />
            <Input label="Port / Area *" value={routeForm.origin_port} onChange={e => setRouteForm(f => ({ ...f, origin_port: e.target.value }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Mode</label>
              <select value={routeForm.mode} onChange={e => setRouteForm(f => ({ ...f, mode: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Load unit</label>
              <select value={routeForm.load_unit} onChange={e => setRouteForm(f => ({ ...f, load_unit: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {LOAD_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Priority</label>
              <select value={routeForm.priority} onChange={e => setRouteForm(f => ({ ...f, priority: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <Input label="Transit days" type="number" min="0" value={routeForm.transit_days} onChange={e => setRouteForm(f => ({ ...f, transit_days: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cost measurement</label>
              <select value={routeForm.cost_measurement} onChange={e => setRouteForm(f => ({ ...f, cost_measurement: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {COST_MEASUREMENTS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Pricing type</label>
              <select value={routeForm.pricing_type} onChange={e => setRouteForm(f => ({ ...f, pricing_type: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="Unit">Fixed unit price</option>
                <option value="Logistics Price Table">Price table (by volume)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Currency</label>
              <select value={routeForm.currency} onChange={e => setRouteForm(f => ({ ...f, currency: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {routeForm.pricing_type === 'Unit' ? (
            <Input label="Cost per unit" type="number" step="0.01" value={routeForm.unit_cost} onChange={e => setRouteForm(f => ({ ...f, unit_cost: e.target.value }))} />
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Price tiers (by volume/weight)</p>
              <div className="space-y-2 mb-3">
                {priceTiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500">From {t.qty_from}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-gray-500">{t.qty_to ? `to ${t.qty_to}` : '∞'}</span>
                    <span className="flex-1 text-right font-mono font-medium">{routeForm.currency} {t.price}</span>
                    <button onClick={async () => {
                      if (t.id) await deletePriceTier(t.id)
                      setPriceTiers(prev => prev.filter((_, j) => j !== i))
                    }} className="text-gray-300 hover:text-red-400"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-end">
                <Input label="From" type="number" value={newTier.qty_from} onChange={e => setNewTier(t => ({ ...t, qty_from: e.target.value }))} className="w-24" />
                <Input label="To (blank=∞)" type="number" value={newTier.qty_to} onChange={e => setNewTier(t => ({ ...t, qty_to: e.target.value }))} className="w-28" />
                <Input label="Price/unit" type="number" step="0.01" value={newTier.price} onChange={e => setNewTier(t => ({ ...t, price: e.target.value }))} className="w-28" />
                <Btn size="sm" variant="secondary" onClick={() => {
                  if (!newTier.qty_from || !newTier.price) return
                  setPriceTiers(prev => [...prev, { qty_from: parseFloat(newTier.qty_from), qty_to: newTier.qty_to ? parseFloat(newTier.qty_to) : null, price: parseFloat(newTier.price) }])
                  setNewTier({ qty_from: '', qty_to: '', price: '' })
                }}><Plus size={12}/>Add tier</Btn>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid from" type="date" value={routeForm.valid_from} onChange={e => setRouteForm(f => ({ ...f, valid_from: e.target.value }))} />
            <Input label="Valid to (blank = open)" type="date" value={routeForm.valid_to || ''} onChange={e => setRouteForm(f => ({ ...f, valid_to: e.target.value }))} />
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-3">
              <Toggle checked={routeForm.eu_customs_required} onChange={v => setRouteForm(f => ({ ...f, eu_customs_required: v }))} />
              <span className="text-sm text-gray-600">EU customs required</span>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={routeForm.active} onChange={v => setRouteForm(f => ({ ...f, active: v }))} />
              <span className="text-sm text-gray-600">Active</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setRouteModal(false)}>Cancel</Btn>
          <Btn onClick={handleSaveRoute} disabled={saving}>{saving ? 'Saving...' : 'Save route'}</Btn>
        </div>
      </Modal>

      {/* Ancillary Modal */}
      <Modal open={ancillaryModal} onClose={() => setAncillaryModal(false)} title={editingAncillary ? 'Edit ancillary cost' : 'New ancillary cost'} width="max-w-lg">
        <div className="space-y-4">
          <Input label="Name *" value={ancillaryForm.name} onChange={e => setAncillaryForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Amount</label>
              <div className="flex gap-2 items-center">
                <input type="number" step="0.01" value={ancillaryForm.amount}
                  onChange={e => setAncillaryForm(f => ({ ...f, amount: e.target.value }))}
                  disabled={ancillaryForm.amount_tbc}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-gray-50"/>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
                  <input type="checkbox" checked={ancillaryForm.amount_tbc}
                    onChange={e => setAncillaryForm(f => ({ ...f, amount_tbc: e.target.checked }))} />
                  TBC
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Currency</label>
              <select value={ancillaryForm.currency} onChange={e => setAncillaryForm(f => ({ ...f, currency: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Applies to load units (blank = all)</label>
            <input type="text" placeholder="e.g. 20' Container (Own), Pallets"
              value={(ancillaryForm.load_units || []).join(', ')}
              onChange={e => setAncillaryForm(f => ({ ...f, load_units: e.target.value ? e.target.value.split(',').map(s => s.trim()) : [] }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid from" type="date" value={ancillaryForm.valid_from} onChange={e => setAncillaryForm(f => ({ ...f, valid_from: e.target.value }))} />
            <Input label="Valid to" type="date" value={ancillaryForm.valid_to || ''} onChange={e => setAncillaryForm(f => ({ ...f, valid_to: e.target.value }))} />
          </div>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <Toggle checked={ancillaryForm.eu_exempt} onChange={v => setAncillaryForm(f => ({ ...f, eu_exempt: v }))} />
              <span className="text-sm text-gray-600">EU customs area exempt</span>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={ancillaryForm.active} onChange={v => setAncillaryForm(f => ({ ...f, active: v }))} />
              <span className="text-sm text-gray-600">Active</span>
            </div>
          </div>
          <Input label="Notes" value={ancillaryForm.notes || ''} onChange={e => setAncillaryForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setAncillaryModal(false)}>Cancel</Btn>
          <Btn onClick={handleSaveAncillary} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
        </div>
      </Modal>

      <Confirm open={!!confirm} message="Delete this item?"
        onConfirm={() => {
          if (confirm?.type === 'partner') { deleteLogisticsPartner(confirm.id).then(() => { setConfirm(null); load() }) }
          if (confirm?.type === 'route') handleDeleteRoute(confirm.id)
          if (confirm?.type === 'ancillary') handleDeleteAncillary(confirm.id)
        }}
        onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
