import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessage } from './ChatMessage'

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Hello!' }} />)
    expect(screen.getByText('Hello!')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'Hi there!' }} />)
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
    expect(screen.getByText('Aiyedun')).toBeInTheDocument()
  })

  it('aligns user messages to the right', () => {
    const { container } = render(<ChatMessage message={{ role: 'user', content: 'Hi' }} />)
    expect(container.firstChild).toHaveClass('justify-end')
  })

  it('aligns assistant messages to the left', () => {
    const { container } = render(<ChatMessage message={{ role: 'assistant', content: 'Hi' }} />)
    expect(container.firstChild).toHaveClass('justify-start')
  })
})
