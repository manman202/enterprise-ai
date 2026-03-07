import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

const items = [
  { label: 'Health', to: '/' },
  { label: 'Chat', to: '/chat' },
]

function renderSidebar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar items={items} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('renders the brand name', () => {
    renderSidebar()
    expect(screen.getByText('Aiyedun')).toBeInTheDocument()
  })

  it('renders all nav items as links', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Health' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
  })

  it('marks the active route link', () => {
    renderSidebar('/chat')
    const activeLink = screen.getByRole('link', { name: 'Chat' })
    expect(activeLink).toHaveClass('bg-gray-800')
  })

  it('does not mark an inactive link as active', () => {
    renderSidebar('/chat')
    const inactiveLink = screen.getByRole('link', { name: 'Health' })
    expect(inactiveLink).not.toHaveClass('bg-gray-800')
  })
})
