import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AdminLayout } from '@/components/layout/Sidebar'
import { Spinner } from '@/components/ui/Spinner'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import UsersPage from '@/pages/UsersPage'
import AuditPage from '@/pages/AuditPage'
import KnowledgePage from '@/pages/KnowledgePage'
import HealthPage from '@/pages/HealthPage'
import AnalyticsPage from '@/pages/AnalyticsPage'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

function AppShell() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/users"      element={<UsersPage />} />
        <Route path="/knowledge"  element={<KnowledgePage />} />
        <Route path="/audit"      element={<AuditPage />} />
        <Route path="/analytics"  element={<AnalyticsPage />} />
        <Route path="/health"     element={<HealthPage />} />
        <Route path="*"           element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <AdminGuard>
              <AppShell />
            </AdminGuard>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
