import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'
import ChatPage from '@/pages/ChatPage'
import DocumentsPage from '@/pages/DocumentsPage'
import HealthPage from '@/pages/HealthPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import SearchPage from '@/pages/SearchPage'

const NAV_ITEMS = [
  { label: 'Chat', to: '/chat' },
  { label: 'Search', to: '/search' },
  { label: 'Documents', to: '/documents' },
  { label: 'Health', to: '/' },
]

function AppShell() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar items={NAV_ITEMS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
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
