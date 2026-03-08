import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="System Health" />)
    expect(screen.getByText('System Health')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<PageHeader title="Docs" actions={<button>Upload</button>} />)
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it('renders no actions slot when omitted', () => {
    const { container } = render(<PageHeader title="Docs" />)
    // Component root div is always present; verify no inner actions div exists
    expect(container.querySelectorAll('div > div > div')).toHaveLength(0)
  })
})
