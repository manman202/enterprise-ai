import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from './RegisterForm'

const VALID = {
  username: 'alice',
  email: 'alice@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
}

async function fillForm(overrides: Partial<typeof VALID> = {}) {
  const vals = { ...VALID, ...overrides }
  await userEvent.type(screen.getByLabelText('Username'), vals.username)
  await userEvent.type(screen.getByLabelText('Email'), vals.email)
  await userEvent.type(screen.getByLabelText('Password'), vals.password)
  await userEvent.type(screen.getByLabelText('Confirm password'), vals.confirmPassword)
}

describe('RegisterForm', () => {
  it('renders all fields and the submit button', () => {
    render(<RegisterForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('enables button when all fields are filled', async () => {
    render(<RegisterForm onSubmit={vi.fn()} />)
    await fillForm()
    expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled()
  })

  it('calls onSubmit with correct values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RegisterForm onSubmit={onSubmit} />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(onSubmit).toHaveBeenCalledWith(
      VALID.username,
      VALID.email,
      VALID.password,
      VALID.confirmPassword,
    )
  })

  it('shows error when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('409 Conflict'))
    render(<RegisterForm onSubmit={onSubmit} />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(screen.getByText('409 Conflict')).toBeInTheDocument())
  })

  it('shows loading spinner while submitting', async () => {
    const onSubmit = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<RegisterForm onSubmit={onSubmit} />)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})
