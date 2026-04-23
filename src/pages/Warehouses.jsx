import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import { getWarehouses, upsertWarehouse, deleteWarehouse } from '../lib/landed'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, Toggle, PageHeader, EmptyState } from '../components/ui'

const empty = { name: '', country: '', city: '', address: '', is_default: false, active: true }

export default function WarehousesPage() {
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
    try { setItems(await getWarehouses()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(w) { setEditing(w); setForm({ ...w }); setModal(true) }

  async function handleSave() {
    if (!form.name || !form.country) return
    setSaving(true)
    try {
      await upsertWarehouse({ ...(editing ? { id: editing.id } : {}), ...form })
      setModal(false)
      setToast({ message: 'Saved', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error saving', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteWarehouse(id); setConfirm(null)
      setToast({ message: 'Deleted', type: 'success' })
      await load()
    } catch { setToast({ message: 'Error deleting', type: 'error' }) }
  }

  return (
    <div>
      <PageHeader title="Warehouses & Destinations"
        action={<Btn onClick={openNew}><Plus size={15}/>New warehouse</Btn>} />

      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      : items.length === 0 ? <EmptyState message="No warehouses configured" />
      : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="text-center px-4 py-3">Default</th>
                <th className="text-center px-4 py-3">Active</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {items.map((w, i) => (
                <tr key={w.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === items.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900 flex items-center gap-2">
                    {w.is_default && <Star size={13} className="text-amber-400 fill-amber-400"/>}
                    {w.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{w.country}</td>
                  <td className="px-4 py-3 text-gray-500">{w.city}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{w.address}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${w.is_default ? 'bg-amber-400' : 'bg-gray-200'}`}/>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${w.active ? 'bg-emerald-400' : 'bg-gray-200'}`}/>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil size={14}/></button>
                      <button onClick={() => setConfirm(w.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit warehouse' : 'New warehouse'} width="max-w-md">
        <div className="space-y-4">
          <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Country *" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            <Input label="City" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </div>
          <Input label="Address" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <div className="flex gap-6">
            <div className="flex items-center gap-3">
              <Toggle checked={form.is_default} onChange={v => setForm(f => ({ ...f, is_default: v }))} />
              <span className="text-sm text-gray-600">Default destination</span>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
              <span className="text-sm text-gray-600">Active</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
        </div>
      </Modal>

      <Confirm open={!!confirm} message="Delete this warehouse?" onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
