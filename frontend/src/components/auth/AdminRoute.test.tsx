import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './AdminRoute'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

const adminUser = { id: '1', username: 'admin', email: 'a@b.com', is_active: true, is_admin: true }
const regularUser = { id: '2', username: 'alice', email: 'c@d.com', is_active: true, is_admin: false }

function renderRoute(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/" element={<div>Home</div>} />
        <Route path="/admin" element={<AdminRoute><div>Admin Content</div></AdminRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminRoute', () => {
  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: vi.fn(), logout: vi.fn() })
    renderRoute()
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
    renderRoute()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects to / when authenticated but not admin', () => {
    mockUseAuth.mockReturnValue({ user: regularUser, loading: false, login: vi.fn(), logout: vi.fn() })
    renderRoute()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders children for admin users', () => {
    mockUseAuth.mockReturnValue({ user: adminUser, loading: false, login: vi.fn(), logout: vi.fn() })
    renderRoute()
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })
})
