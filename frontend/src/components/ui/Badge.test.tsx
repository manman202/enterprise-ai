import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>ok</Badge>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('applies ok variant classes', () => {
    render(<Badge variant="ok">ok</Badge>)
    expect(screen.getByText('ok')).toHaveClass('text-green-400')
  })

  it('applies error variant classes', () => {
    render(<Badge variant="error">down</Badge>)
    expect(screen.getByText('down')).toHaveClass('text-red-400')
  })

  it('applies warning variant classes', () => {
    render(<Badge variant="warning">slow</Badge>)
    expect(screen.getByText('slow')).toHaveClass('text-yellow-400')
  })

  it('defaults to neutral variant', () => {
    render(<Badge>unknown</Badge>)
    expect(screen.getByText('unknown')).toHaveClass('text-gray-400')
  })
})
