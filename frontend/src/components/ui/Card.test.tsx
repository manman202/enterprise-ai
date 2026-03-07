import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Card title="Overview">Content</Card>)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('does not render a title element when omitted', () => {
    render(<Card>Content</Card>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
