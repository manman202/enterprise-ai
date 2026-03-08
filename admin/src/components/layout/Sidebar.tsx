import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  BarChart2,
  Activity,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { knowledgeSourcesApi } from '@/api/knowledge_sources'

// NAV_ITEMS is defined dynamically below so we can inject the error badge count
const BASE_NAV_ITEMS = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Users',         icon: Users,           path: '/users' },
  { label: 'Knowledge',     icon: BookOpen,        path: '/knowledge' },
  { label: 'Audit Logs',    icon: FileText,        path: '/audit' },
  { label: 'Analytics',     icon: BarChart2,       path: '/analytics' },
  { label: 'System Health', icon: Activity,        path: '/health' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth()
  const [knowledgeErrors, setKnowledgeErrors] = useState(0)

  // Check for knowledge sources with error status (refresh every 60s)
  useEffect(() => {
    const check = () => {
      knowledgeSourcesApi.list()
        .then((sources) => setKnowledgeErrors(sources.filter((s) => s.status === 'error').length))
        .catch(() => {}) // non-fatal
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <aside
      style={{ backgroundColor: '#1e3a5f', width: 240 }}
      className="flex h-full flex-col"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div>
          <span className="block text-sm font-bold tracking-widest text-white uppercase">
            AIYEDUN
          </span>
          <span className="block text-xs text-gray-300 mt-0.5">Admin Panel</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-300 hover:text-white hover:bg-white/10 md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {BASE_NAV_ITEMS.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-white text-[#1e3a5f] font-semibold'
                  : 'text-gray-200 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {/* Error badge — shown on Knowledge nav item when sources have errors */}
            {label === 'Knowledge' && knowledgeErrors > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {knowledgeErrors}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + logout */}
      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <p className="mb-3 truncate text-xs text-gray-300">
            Logged in as{' '}
            <span className="font-semibold text-white">{user.username}</span>
          </p>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300
                     hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={16} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex md:shrink-0" style={{ width: 240 }}>
        <div className="flex h-screen flex-col" style={{ width: 240, position: 'sticky', top: 0 }}>
          <SidebarContent />
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-50 flex h-full flex-col" style={{ width: 240 }}>
            <SidebarContent onClose={onClose} />
          </div>
        </div>
      )}
    </>
  )
}

/** Wrapper that includes the sidebar + main content area with mobile hamburger. */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold tracking-widest text-[#1e3a5f] uppercase">
            AIYEDUN
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}

// Keep backward-compat NavItem export (App.tsx used to pass items prop)
export interface NavItem {
  label: string
  to: string
}
