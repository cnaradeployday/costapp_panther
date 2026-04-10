import { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm ───────────────────────────────────────────────────
export function Confirm({ open, onConfirm, onCancel, message }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex gap-3 items-start mb-5">
          <AlertTriangle size={22} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-gray-700 text-sm">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
          <Btn variant="danger" onClick={onConfirm}>Eliminar</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-red-500',
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colors[type]} flex items-center gap-2`}>
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14}/></button>
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', type = 'button', disabled, className = '', size = 'md' }) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
      <input
        {...props}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-gray-50"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────
export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
      <select
        {...props}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:    'bg-gray-100 text-gray-700',
    blue:    'bg-blue-50 text-blue-700',
    amber:   'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet:  'bg-violet-50 text-violet-700',
    red:     'bg-red-50 text-red-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

// ── CategoryBadge ─────────────────────────────────────────────
export function CategoryBadge({ category }) {
  const map = {
    LANDED:      { color: 'blue',    label: 'Landed' },
    ORIGINATION: { color: 'amber',   label: 'Origination' },
    HIT:         { color: 'emerald', label: 'Hit' },
  }
  const { color, label } = map[category] ?? { color: 'gray', label: category }
  return <Badge color={color}>{label}</Badge>
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({ message }) {
  return (
    <div className="text-center py-16 text-gray-400 text-sm">{message}</div>
  )
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {action}
    </div>
  )
}

// ── SearchInput ───────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-900"
    />
  )
}

// ── Toggle ────────────────────────────────────────────────────
export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? 'bg-slate-900' : 'bg-gray-300'}`}
      style={{ height: '22px', minWidth: '40px' }}
    >
      <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`}
        style={{ width: '18px', height: '18px', display: 'block' }} />
    </button>
  )
}
