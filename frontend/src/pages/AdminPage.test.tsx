import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from './AdminPage'
import * as adminModule from '@/api/admin'
import * as AuthContext from '@/contexts/AuthContext'

vi.mock('@/api/admin', () => ({
  adminApi: { listUsers: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockListUsers = vi.mocked(adminModule.adminApi.listUsers)
const mockUpdateUser = vi.mocked(adminModule.adminApi.updateUser)
const mockDeleteUser = vi.mocked(adminModule.adminApi.deleteUser)
const mockUseAuth = vi.mocked(AuthContext.useAuth)

const adminUser = { id: 'admin-1', username: 'admin', email: 'a@b.com', is_active: true, is_admin: true }
const alice = { id: 'user-1', username: 'alice', email: 'c@d.com', is_active: true, is_admin: false }

function renderPage() {
  return render(<MemoryRouter><AdminPage /></MemoryRouter>)
}

beforeEach(() => {
  mockListUsers.mockReset()
  mockUpdateUser.mockReset()
  mockDeleteUser.mockReset()
  mockUseAuth.mockReturnValue({ user: adminUser, loading: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() })
})

describe('AdminPage', () => {
  it('loads and displays users', async () => {
    mockListUsers.mockResolvedValue([adminUser, alice])
    renderPage()
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('shows error when list fails', async () => {
    mockListUsers.mockRejectedValue(new Error('403 Forbidden'))
    renderPage()
    await waitFor(() => expect(screen.getByText('403 Forbidden')).toBeInTheDocument())
  })

  it('updates user after toggle active', async () => {
    mockListUsers.mockResolvedValue([adminUser, alice])
    mockUpdateUser.mockResolvedValue({ ...alice, is_active: false })
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument())
  })

  it('removes user after delete', async () => {
    mockListUsers.mockResolvedValue([adminUser, alice])
    mockDeleteUser.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('alice')).not.toBeInTheDocument())
  })
})
