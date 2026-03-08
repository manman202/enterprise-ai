import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileForm } from './ProfileForm'
import type { AuthUser } from '@/api/auth'

vi.mock('@/api/settings', () => ({
  settingsApi: { updateProfile: vi.fn() },
}))

import { settingsApi } from '@/api/settings'
const mockUpdateProfile = vi.mocked(settingsApi.updateProfile)

const user: AuthUser = { id: '1', username: 'alice', email: 'a@b.com', is_active: true, is_admin: false }

describe('ProfileForm', () => {
  it('renders with pre-filled values', () => {
    render(<ProfileForm user={user} onUpdated={vi.fn()} />)
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('a@b.com')).toBeInTheDocument()
  })

  it('calls updateProfile and onUpdated on submit', async () => {
    const onUpdated = vi.fn().mockResolvedValue(undefined)
    mockUpdateProfile.mockResolvedValue(user)
    render(<ProfileForm user={user} onUpdated={onUpdated} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mockUpdateProfile).toHaveBeenCalled()
    await screen.findByText('Profile updated.')
    expect(onUpdated).toHaveBeenCalled()
  })

  it('shows error when updateProfile rejects', async () => {
    const onUpdated = vi.fn()
    mockUpdateProfile.mockRejectedValue(new Error('Username already taken'))
    render(<ProfileForm user={user} onUpdated={onUpdated} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Username already taken')
    expect(onUpdated).not.toHaveBeenCalled()
  })
})
