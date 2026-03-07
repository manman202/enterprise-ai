import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders without a label', () => {
    render(<Textarea placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('renders label linked to textarea', () => {
    render(<Textarea label="Notes" />)
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })

  it('displays an error message', () => {
    render(<Textarea label="Notes" error="Too short" />)
    expect(screen.getByText('Too short')).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toHaveClass('border-red-500')
  })

  it('accepts user input', async () => {
    render(<Textarea label="Notes" />)
    await userEvent.type(screen.getByLabelText('Notes'), 'Hello')
    expect(screen.getByLabelText('Notes')).toHaveValue('Hello')
  })
})
