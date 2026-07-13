import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getLabourRates, upsertLabourRate, deleteLabourRate } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { Modal, Confirm, Toast, Btn, Input, EmptyState, PageHeader, Toggle } from '../components/ui'

const SKILLS = ['Printer', 'Assembly', 'Logistics']
const LEVELS = ['Trainee (1-3 years)', 'Skilled (4+ years)']
const today = () => new Date().toISOString().slice(0, 10)
const empty = { skill: '', experience_level: '', cost_per_hour: '', effective_date: today(), active: true }

export default function LabourPage() {
  const { T, currency, tabVisible } = useApp()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    try { setRates(await getLabourRates()) }
    catch { setToast({ message: T('error'), type: 'error' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabVisible])

  function openNew() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(r) {
    setEditing(r)
    setForm({
      skill: r.skill,
      experience_level: r.experience_level,
      cost_per_hour: String(r.cost_per_hour),
      effective_date: r.effective_date ?? today(),
      active: r.active,
    })
    setModal(true)
  }

  async function handleSave() {
    if (!form.skill.trim() || !form.experience_level.trim()) return
    setSaving(true)
    try {
      await upsertLabourRate({
        ...(editing ? { id: editing.id } : {}),
        skill: form.skill.trim(),
        experience_level: form.experience_level.trim(),
        cost_per_hour: parseFloat(form.cost_per_hour) || 0,
        effective_date: form.effective_date || today(),
        active: form.active,
      })
      setModal(false)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch (e) {
      setToast({ message: e.message?.includes('unique') ? 'That Skill + Experience Level already exists' : T('error'), type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await deleteLabourRate(id)
      setConfirm(null)
      setToast({ message: T('saved'), type: 'success' })
      await load()
    } catch {
      setToast({ message: 'Cannot delete — in use by a cost item', type: 'error' })
      setConfirm(null)
    }
  }

  return (
    <div>
      <PageHeader title="Labour costs"
        action={<Btn onClick={openNew}><Plus size={15}/>New rate</Btn>} />

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{T('loading')}</div>
      ) : rates.length === 0 ? (
        <EmptyState message="No labour rates yet" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <th className="text-left px-5 py-3">Labour skill</th>
                <th className="text-left px-4 py-3">Experience level</th>
                <th className="text-right px-4 py-3">Cost / hour (incl. overheads)</th>
                <th className="text-right px-4 py-3">Cost / minute</th>
                <th className="text-left px-4 py-3">Effective date</th>
                <th className="text-center px-4 py-3">{T('active')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === rates.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.skill}</td>
                  <td className="px-4 py-3 text-gray-500">{r.experience_level}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{currency} {parseFloat(r.cost_per_hour).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">{currency} {(parseFloat(r.cost_per_hour) / 60).toFixed(4)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.effective_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${r.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil size={14}/>
                      </button>
                      <button onClick={() => setConfirm(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit labour rate' : 'New labour rate'} width="max-w-md">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Labour skill</label>
            <input list="labour-skills" value={form.skill}
              onChange={e => setForm(f => ({ ...f, skill: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            <datalist id="labour-skills">
              {SKILLS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Experience level</label>
            <input list="labour-levels" value={form.experience_level}
              onChange={e => setForm(f => ({ ...f, experience_level: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            <datalist id="labour-levels">
              {LEVELS.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
          <Input label="Cost / hour (incl. overheads)" type="number" step="0.01" min="0"
            value={form.cost_per_hour}
            onChange={e => setForm(f => ({ ...f, cost_per_hour: e.target.value }))} />
          {form.cost_per_hour !== '' && (
            <p className="text-xs text-gray-400 -mt-2">
              = {currency} {((parseFloat(form.cost_per_hour) || 0) / 60).toFixed(4)} / minute
            </p>
          )}
          <Input label="Effective date" type="date"
            value={form.effective_date}
            onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
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
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
