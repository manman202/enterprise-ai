import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Sidebar, NavItem } from '@/components/layout/Sidebar'
import AdminPage from '@/pages/AdminPage'
import ChatPage from '@/pages/ChatPage'
import DocumentsPage from '@/pages/DocumentsPage'
import HealthPage from '@/pages/HealthPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import SearchPage from '@/pages/SearchPage'
import SettingsPage from '@/pages/SettingsPage'

const BASE_NAV: NavItem[] = [
  { label: 'Chat', to: '/chat' },
  { label: 'Search', to: '/search' },
  { label: 'Documents', to: '/documents' },
  { label: 'Settings', to: '/settings' },
  { label: 'Health', to: '/' },
]

function AppShell() {
  const { user } = useAuth()
  const navItems = user?.is_admin ? [...BASE_NAV, { label: 'Admin', to: '/admin' }] : BASE_NAV

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar items={navItems} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<HealthPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
