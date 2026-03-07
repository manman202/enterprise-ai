import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders with accessible label', () => {
    render(<Spinner />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('applies sm size class', () => {
    render(<Spinner size="sm" />)
    expect(screen.getByLabelText('Loading')).toHaveClass('h-3.5')
  })

  it('applies lg size class', () => {
    render(<Spinner size="lg" />)
    expect(screen.getByLabelText('Loading')).toHaveClass('h-8')
  })
})
