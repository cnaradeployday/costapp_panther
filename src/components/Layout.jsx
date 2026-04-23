import { NavLink, useNavigate } from 'react-router-dom'
import { Calculator, Tag, Printer, Package, Users, Settings, LogOut, Menu, Percent, Ruler, Ship, Truck, Landmark, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { signOut } from '../lib/supabase'
import logo from '../assets/logopanther.jpg'

const APP_VERSION = '1.2.0'

export default function Layout({ children }) {
  const { profile, config, T } = useApp()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isSuperAdmin = profile?.role === 'superadmin'

  const navItems = [
    { to: '/', icon: Calculator, label: T('calculator') },
    ...(isAdmin ? [
      { to: '/landed', icon: Ship, label: 'LANDED', section: true },
      { to: '/landed/partners', icon: Truck, label: 'Logistics Partners' },
      { to: '/landed/warehouses', icon: Landmark, label: 'Warehouses' },
      { to: '/landed/rates', icon: TrendingUp, label: 'Exchange Rates' },
      { to: '/costs', icon: Tag, label: T('costs'), section: true },
      { to: '/units', icon: Ruler, label: 'Units of measure' },
      { to: '/techniques', icon: Printer, label: T('techniques') },
      { to: '/products', icon: Package, label: T('products') },
      { to: '/margins', icon: Percent, label: 'Margins & Breaks' },
    ] : []),
    ...(isSuperAdmin ? [
      { to: '/users', icon: Users, label: T('users') },
      { to: '/config', icon: Settings, label: T('config') },
    ] : []),
  ]

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 truncate">{config?.company_name}</h2>
            <p className="text-xs text-gray-400">{config?.currency_code} · {config?.language?.toUpperCase()}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, section }) => (
          section && to !== '/' ? (
            <div key={to + '_section'}>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            </div>
          ) : (
            <NavLink key={to} to={to} end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
              <Icon size={17} />
              {label}
            </NavLink>
          )
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-medium text-gray-900 truncate">{profile?.email}</p>
          <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <LogOut size={16} />
          {T('logout')}
        </button>
        <p className="text-center text-xs text-gray-300 mt-3">v{APP_VERSION}</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 shrink-0">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-7 h-7 rounded object-cover" />
            <span className="text-sm font-semibold text-gray-900">{config?.company_name}</span>
          </div>
          <div className="w-9" />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
