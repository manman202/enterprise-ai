import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserTable } from './UserTable'
import type { AuthUser } from '@/api/auth'

const admin: AuthUser = { id: 'admin-1', username: 'admin', email: 'a@b.com', is_active: true, is_admin: true }
const alice: AuthUser = { id: 'user-1', username: 'alice', email: 'c@d.com', is_active: true, is_admin: false }
const inactive: AuthUser = { id: 'user-2', username: 'bob', email: 'e@f.com', is_active: false, is_admin: false }

const defaultProps = {
  currentUserId: 'admin-1',
  pendingId: null,
  onToggleActive: vi.fn(),
  onToggleAdmin: vi.fn(),
  onDelete: vi.fn(),
}

describe('UserTable', () => {
  it('shows empty state when no users', () => {
    render(<UserTable users={[]} {...defaultProps} />)
    expect(screen.getByText('No users found.')).toBeInTheDocument()
  })

  it('renders username and email for each user', () => {
    render(<UserTable users={[admin, alice]} {...defaultProps} />)
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
  })

  it('marks current user with (you)', () => {
    render(<UserTable users={[admin]} {...defaultProps} />)
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })

  it('disables all actions for current user', () => {
    render(<UserTable users={[admin]} {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('shows Active badge for active users', () => {
    render(<UserTable users={[alice]} {...defaultProps} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Inactive badge for inactive users', () => {
    render(<UserTable users={[inactive]} {...defaultProps} />)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows Admin badge for admin users', () => {
    render(<UserTable users={[admin]} {...defaultProps} />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('calls onToggleActive when Deactivate is clicked', async () => {
    const onToggleActive = vi.fn()
    render(<UserTable users={[alice]} {...defaultProps} onToggleActive={onToggleActive} />)
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onToggleActive).toHaveBeenCalledWith(alice)
  })

  it('calls onToggleAdmin when Make admin is clicked', async () => {
    const onToggleAdmin = vi.fn()
    render(<UserTable users={[alice]} {...defaultProps} onToggleAdmin={onToggleAdmin} />)
    await userEvent.click(screen.getByRole('button', { name: 'Make admin' }))
    expect(onToggleAdmin).toHaveBeenCalledWith(alice)
  })

  it('calls onDelete when Delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<UserTable users={[alice]} {...defaultProps} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(alice)
  })
})
