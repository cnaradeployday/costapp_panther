import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Toggle, PageHeader, EmptyState } from '../components/ui'

async function getHsCodes() {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.from('hs_codes').select('*').order('code')
  if (error) throw error
  return data
}
async function upsertHsCode(h) {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.from('hs_codes').upsert({ ...h, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}
async function deleteHsCode(id) {
  const { supabase } = await import('../lib/supabase')
  const { error } = await supabase.from('hs_codes').delete().eq('id', id)
  if (error) throw error
}

const empty = { code: '', description: '', duty_rate: '', notes: '', active: true }

export default function HsCodesPage() {
  const { tabVisible } = useApp()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try { setItems(await getHsCodes()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(h) {
    setEditing(h)
    setForm({ ...h, duty_rate: String(parseFloat(h.duty_rate) * 100) })
    setModal(true)
  }

  async function handleSave() {
    if (!form.code || !form.description) return
    setSaving(true)
    try {
      await upsertHsCode({
        ...(editing ? { id: editing.id } : {}),
        code: form.code.trim(),
        description: form.description,
        duty_rate: (parseFloat(form.duty_rate) || 0) / 100,
        notes: form.notes,
        active: form.active,
      })
      setModal(false); setToast({ message: 'Saved', type: 'success' }); await load()
    } catch (e) {
      setToast({ message: e.message?.includes('unique') ? 'HS code already exists' : 'Error', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try { await deleteHsCode(id); setConfirm(null); setToast({ message: 'Deleted', type: 'success' }); await load() }
    catch { setToast({ message: 'Cannot delete — in use by a product', type: 'error' }); setConfirm(null) }
  }

  return (
    <div>
      <PageHeader title="HS Codes & Import Duties"
        action={<Btn onClick={openNew}><Plus size={15}/>New HS code</Btn>} />
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <strong>How it works:</strong> Each HS code has a duty rate for non-EU imports. Products from EU countries always pay 0%. Products from outside the EU pay the rate here, calculated on FOB.
      </div>
      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      : items.length === 0 ? <EmptyState message="No HS codes configured" />
      : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider"><th className="text-left px-5 py-3">HS Code</th><th className="text-left px-4 py-3">Description</th><th className="text-right px-4 py-3">Duty rate (non-EU)</th><th className="text-center px-4 py-3">Active</th><th className="px-4 py-3"/></tr></thead>
            <tbody>{items.map((h, i) => (
              <tr key={h.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i === items.length-1 ? 'border-0': ''}`}>
                <td className="px-5 py-3 font-mono font-medium text-gray-900">{h.code}</td>
                <td className="px-4 py-3 text-gray-600">{h.description}</td>
                <td className="px-4 py-3 text-right"><span className={`text-xs px-2 py-0.5 rounded-lg font-medium font-mono ${parseFloat(h.duty_rate)>0 ? 'bg-amber-50 text-amber-700':'bg-gray-100 text-gray-500'}`}>{parseFloat(h.duty_rate)*100}%toFixed(2)}%</span></td>
                <td className="px-4 py-3 text-center"><span className={`inline-block w-2 h-2 rounded-full ${h.active?'bg-emerald-400':'bg-gray-200'}`}/></td>
                <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={()=>openEdit(h)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil size={14}/></button><button onClick={()=>setConfirm(h.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing ? 'Edit HS code':'New HS code'} width="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="HS Code *" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="e.g. 4820.10.20" />
            <Input label="Duty rate % (non-EU) *" type="number" step="0.01" min="0" max="100" value={form.duty_rate} onChange={e=>setForm(f=>({...f,duty_rate:e.target.value}))} placeholder="e.g. 12 for 12%" />
          </div>
          <Input label="Description *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Folders of plastics" />
          <Input label="Notes" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600">EU countries always pay 0% regardless of this rate.</div>
          <div className="flex items-center gap-3"><Toggle checked={form.active} onChange={v=>setForm(f=>({...f,active:v}))} /><span className="text-sm text-gray-600">Active</span></div>
        </div>
        <div className="flex justify-end gap-3 mt-6"><Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save'}</Btn></div>
      </Modal>
      <Confirm open={!!confirm} message="Delete this HS code?" onConfirm={()=>handleDelete(confirm)} onCancel={()=>setConfirm(null)} />
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </div>
  )
}