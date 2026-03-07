import { Routes, Route, NavLink } from 'react-router-dom'
import HealthPage from '@/pages/HealthPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="font-semibold tracking-wide">Aiyedun</span>
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? 'text-blue-400 text-sm' : 'text-gray-400 text-sm hover:text-gray-200'
          }
        >
          Health
        </NavLink>
      </nav>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<HealthPage />} />
        </Routes>
      </main>
    </div>
  )
}
