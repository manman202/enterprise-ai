import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import ChatPage from '@/pages/ChatPage'
import DocumentsPage from '@/pages/DocumentsPage'
import HealthPage from '@/pages/HealthPage'
import SearchPage from '@/pages/SearchPage'

const NAV_ITEMS = [
  { label: 'Chat', to: '/chat' },
  { label: 'Search', to: '/search' },
  { label: 'Documents', to: '/documents' },
  { label: 'Health', to: '/' },
]

export default function App() {
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
