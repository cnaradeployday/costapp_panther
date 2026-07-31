import { NavLink, useNavigate } from 'react-router-dom'
import { Calculator, Tag, Printer, Package, Users, Settings, LogOut, Menu, Percent, Ruler, Ship, Truck, Landmark, TrendingUp, FileText, HardHat, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../lib/AppContext'
import { signOut } from '../lib/supabase'
import logo from '../assets/logopanther.jpg'

const APP_VERSION = '1.2.0'
const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed'

export default function Layout({ children }) {
  const { profile, config, T } = useApp()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isSuperAdmin = profile?.role === 'superadmin'

  const navItems = [
    { to: '/', icon: Calculator, label: T('calculator') },
    ...(isAdmin ? [
      { to: '/landed', icon: Ship, label: 'LANDED', section: true },
      { to: '/landed/partners', icon: Truck, label: 'Logistics Partners' },
      { to: '/landed/warehouses', icon: Landmark, label: 'Warehouses' },
      { to: '/landed/rates', icon: TrendingUp, label: 'Exchange Rates' },
      { to: '/landed/hscodes', icon: FileText, label: 'HS Codes & Duties' },
      { to: '/costs', icon: Tag, label: T('costs') },
      { to: '/labour', icon: HardHat, label: 'Labour costs' },
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

  const SidebarContent = ({ isCollapsed = false }) => (
    <div className="flex flex-col h-full">
      <div className={`py-5 border-b border-gray-100 ${isCollapsed ? 'px-3' : 'px-5'}`}>
        <div className={`flex items-center mb-2 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          {!isCollapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{config?.company_name}</h2>
              <p className="text-xs text-gray-400">{config?.currency_code} · {config?.language?.toUpperCase()}</p>
            </div>
          )}
        </div>
      </div>
      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map(({ to, icon: Icon, label, section }) => (
          section && to !== '/' ? (
            isCollapsed ? (
              <div key={to + '_section'} className="my-2 border-t border-gray-100" />
            ) : (
              <div key={to + '_section'}>
                <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            )
          ) : (
            <NavLink key={to} to={to} end={to === '/'}
              title={isCollapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  isActive ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
              <Icon size={17} />
              {!isCollapsed && label}
            </NavLink>
          )
        ))}
      </nav>
      <div className={`py-4 border-t border-gray-100 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-gray-900 truncate">{profile?.email}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
          </div>
        )}
        <button onClick={handleLogout} title={isCollapsed ? T('logout') : undefined}
          className={`flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
          <LogOut size={16} />
          {!isCollapsed && T('logout')}
        </button>
        {!isCollapsed && <p className="text-center text-xs text-gray-300 mt-3">v{APP_VERSION}</p>}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-100 shrink-0 relative transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-60'}`}>
        <SidebarContent isCollapsed={collapsed} />
        <button onClick={toggleCollapsed}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors z-10">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
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
          <div className={collapsed ? 'max-w-none' : 'max-w-5xl mx-auto'}>{children}</div>
        </main>
      </div>
    </div>
  )
}
