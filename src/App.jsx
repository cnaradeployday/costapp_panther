import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './lib/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import CostsPage from './pages/Costs'
import TechniquesPage from './pages/Techniques'
import ProductsPage from './pages/Products'
import CalculatorPage from './pages/Calculator'
import { ConfigPage, UsersPage } from './pages/Config'

function ProtectedRoute({ children, requireAdmin, requireSuperAdmin }) {
  const { user, profile, loading } = useApp()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Cargando...</div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (requireSuperAdmin && profile?.role !== 'superadmin') return <Navigate to="/" replace />
  if (requireAdmin && !['admin', 'superadmin'].includes(profile?.role)) return <Navigate to="/" replace />

  return children
}

function AppRoutes() {
  const { user, loading } = useApp()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Cargando...</div>
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout><CalculatorPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/costs" element={
        <ProtectedRoute requireAdmin>
          <Layout><CostsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/techniques" element={
        <ProtectedRoute requireAdmin>
          <Layout><TechniquesPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute requireAdmin>
          <Layout><ProductsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute requireSuperAdmin>
          <Layout><UsersPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/config" element={
        <ProtectedRoute requireSuperAdmin>
          <Layout><ConfigPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
