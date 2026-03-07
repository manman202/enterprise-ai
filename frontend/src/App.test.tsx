import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('@/api/client', () => ({ api: { get: vi.fn().mockReturnValue(new Promise(() => {})) } }))

describe('App', () => {
  it('renders the nav brand and Health link', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('Aiyedun')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Health' })).toBeInTheDocument()
  })

  it('renders HealthPage at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('System Health')).toBeInTheDocument()
  })
})
