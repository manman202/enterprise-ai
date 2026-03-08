import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import * as authModule from '@/api/auth'
import * as AuthContext from '@/contexts/AuthContext'

vi.mock('@/api/auth', () => ({
  authApi: { register: vi.fn(), login: vi.fn(), me: vi.fn() },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockRegister = vi.mocked(authModule.authApi.register)
const mockUseAuth = vi.mocked(AuthContext.useAuth)

const user = { id: '1', username: 'charlie', email: 'c@c.com', is_active: true }

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockRegister.mockReset()
  mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
})

describe('RegisterPage', () => {
  it('renders the register form', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('has a link to the login page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('calls register then login on successful submission', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, logout: vi.fn() })
    mockRegister.mockResolvedValue(user)

    renderPage()
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Email'), 'c@c.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('charlie', 'c@c.com', 'Password1', 'Password1'))
    expect(mockLogin).toHaveBeenCalledWith('charlie', 'Password1')
  })

  it('shows error when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('409 Conflict'))
    renderPage()
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Email'), 'c@c.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(screen.getByText('409 Conflict')).toBeInTheDocument())
  })
})
