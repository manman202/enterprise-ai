import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import * as authModule from '@/api/auth'
import { TOKEN_KEY } from '@/api/client'

vi.mock('@/api/auth', () => ({
  authApi: { login: vi.fn(), me: vi.fn() },
}))

const mockLogin = vi.mocked(authModule.authApi.login)
const mockMe = vi.mocked(authModule.authApi.me)

const user = { id: '1', username: 'alice', email: 'a@b.com', is_active: true }

function TestConsumer() {
  const { user: authUser, loading, login, logout } = useAuth()
  return (
    <div>
      {loading && <span>Loading</span>}
      {authUser ? <span>Hello {authUser.username}</span> : <span>Logged out</span>}
      <button onClick={() => login('alice', 'secret')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

function renderConsumer() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockLogin.mockReset()
  mockMe.mockReset()
  localStorage.removeItem(TOKEN_KEY)
})

describe('AuthContext', () => {
  it('starts logged out with no stored token', async () => {
    mockMe.mockResolvedValue(user)
    renderConsumer()
    await waitFor(() => expect(screen.queryByText('Loading')).not.toBeInTheDocument())
    expect(screen.getByText('Logged out')).toBeInTheDocument()
  })

  it('restores session from stored token on mount', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    mockMe.mockResolvedValue(user)
    renderConsumer()
    await waitFor(() => expect(screen.getByText('Hello alice')).toBeInTheDocument())
  })

  it('clears token if /me fails on mount', async () => {
    localStorage.setItem(TOKEN_KEY, 'bad-token')
    mockMe.mockRejectedValue(new Error('401'))
    renderConsumer()
    await waitFor(() => expect(screen.getByText('Logged out')).toBeInTheDocument())
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('logs in and sets user', async () => {
    mockLogin.mockResolvedValue({ access_token: 'tok', token_type: 'bearer' })
    mockMe.mockResolvedValue(user)
    renderConsumer()
    await waitFor(() => expect(screen.getByText('Logged out')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    await waitFor(() => expect(screen.getByText('Hello alice')).toBeInTheDocument())
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok')
  })

  it('logs out and clears user', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    mockMe.mockResolvedValue(user)
    renderConsumer()
    await waitFor(() => expect(screen.getByText('Hello alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByText('Logged out')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
