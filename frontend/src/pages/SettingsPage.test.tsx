import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/api/settings', () => ({
  settingsApi: { updateProfile: vi.fn(), changePassword: vi.fn() },
}))

import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

const authUser = { id: '1', username: 'alice', email: 'a@b.com', is_active: true, is_admin: false }

function renderPage() {
  return render(<MemoryRouter><SettingsPage /></MemoryRouter>)
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: authUser, loading: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() })
})

describe('SettingsPage', () => {
  it('renders profile and password forms', () => {
    renderPage()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
  })

  it('shows the current username and email pre-filled', () => {
    renderPage()
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('a@b.com')).toBeInTheDocument()
  })

  it('renders nothing when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() })
    const { container } = renderPage()
    expect(container).toBeEmptyDOMElement()
  })
})
