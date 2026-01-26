import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/common/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Customers from './pages/Customers'
import ApiKeys from './pages/ApiKeys'
import Settings from './pages/Settings'
import Billing from './pages/Billing'
import SmartRouting from './pages/SmartRouting'
import Predictions from './pages/Predictions'
import Workflows from './pages/Workflows'
import AgentEfficiency from './pages/AgentEfficiency'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuthStore()

  // Wait for auth state to hydrate from localStorage before making auth decisions
  if (!_hasHydrated) {
    // Show a loading state while hydrating
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()

  // Wait for auth state to hydrate from localStorage before making auth decisions
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/app/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="smart-routing" element={<SmartRouting />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="agent-efficiency" element={<AgentEfficiency />} />
        <Route path="customers" element={<Customers />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        {/* Catch-all for invalid /app/* routes */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Catch-all for all other invalid routes */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
