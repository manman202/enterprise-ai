import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import HealthPage from '@/pages/HealthPage'

const NAV_ITEMS = [{ label: 'Health', to: '/' }]

export default function App() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <Sidebar items={NAV_ITEMS} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<HealthPage />} />
        </Routes>
      </main>
    </div>
  )
}
