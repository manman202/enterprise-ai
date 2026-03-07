import { NavLink } from 'react-router-dom'

export interface NavItem {
  label: string
  to: string
}

interface SidebarProps {
  items: NavItem[]
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="flex h-screen w-52 flex-col border-r border-gray-800 bg-gray-950 px-3 py-4">
      <span className="mb-6 px-2 text-base font-semibold tracking-wide text-gray-100">
        Aiyedun
      </span>
      <nav className="flex flex-col gap-0.5">
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
    </aside>
  )
}
