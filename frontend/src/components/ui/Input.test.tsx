import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders without a label', () => {
    render(<Input placeholder="Search" />)
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
  })

  it('renders label linked to input', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('displays an error message', () => {
    render(<Input label="Email" error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveClass('border-red-500')
  })

  it('accepts user input', async () => {
    render(<Input label="Name" />)
    const input = screen.getByLabelText('Name')
    await userEvent.type(input, 'Alice')
    expect(input).toHaveValue('Alice')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Input label="Name" disabled />)
    expect(screen.getByLabelText('Name')).toBeDisabled()
  })
})
