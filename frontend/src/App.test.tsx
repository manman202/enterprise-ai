import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'aiyedun_token',
  api: { get: vi.fn().mockReturnValue(new Promise(() => {})), post: vi.fn(), del: vi.fn(), upload: vi.fn() },
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    me: vi.fn().mockReturnValue(new Promise(() => {})),
    login: vi.fn(),
  },
}))

vi.mock('@/api/documents', () => ({ documentsApi: { list: vi.fn().mockReturnValue(new Promise(() => {})), upload: vi.fn(), delete: vi.fn() } }))
vi.mock('@/api/search', () => ({ searchApi: { search: vi.fn() } }))

describe('App', () => {
  it('renders the login page at /login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows loading spinner on protected routes while auth resolves', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})
