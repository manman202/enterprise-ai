import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordForm } from './PasswordForm'

vi.mock('@/api/settings', () => ({
  settingsApi: { changePassword: vi.fn() },
}))

import { settingsApi } from '@/api/settings'
const mockChangePassword = vi.mocked(settingsApi.changePassword)

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Current password'), 'OldPass1')
  await userEvent.type(screen.getByLabelText('New password'), 'NewPass1')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass1')
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('PasswordForm', () => {
  it('calls changePassword and shows success', async () => {
    mockChangePassword.mockResolvedValue(undefined)
    render(<PasswordForm />)
    await fillAndSubmit()
    await screen.findByText('Password updated.')
    expect(mockChangePassword).toHaveBeenCalledWith({
      current_password: 'OldPass1',
      new_password: 'NewPass1',
      confirm_password: 'NewPass1',
    })
  })

  it('shows error when passwords do not match', async () => {
    render(<PasswordForm />)
    await userEvent.type(screen.getByLabelText('Current password'), 'OldPass1')
    await userEvent.type(screen.getByLabelText('New password'), 'NewPass1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('shows error when changePassword rejects', async () => {
    mockChangePassword.mockRejectedValue(new Error('Current password is incorrect'))
    render(<PasswordForm />)
    await fillAndSubmit()
    await screen.findByText('Current password is incorrect')
  })
})
