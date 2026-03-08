import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

export interface NavItem {
  label: string
  to: string
}

interface SidebarProps {
  items: NavItem[]
}

export function Sidebar({ items }: SidebarProps) {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-gray-800 bg-gray-950 px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-base font-semibold tracking-wide text-gray-100">Aiyedun</span>
        <p className="text-xs text-gray-500">Admin Panel</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-gray-800 text-gray-100'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="border-t border-gray-800 pt-3">
          <p className="mb-2 truncate px-2 text-xs text-gray-500">{user.username}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            Sign out
          </Button>
        </div>
      )}
    </aside>
  )
}
