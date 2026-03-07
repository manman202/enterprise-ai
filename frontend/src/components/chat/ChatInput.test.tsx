import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('renders the textarea and send button', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('send button enables when input has text', async () => {
    render(<ChatInput onSend={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello')
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled()
  })

  it('calls onSend with trimmed message on button click', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    await userEvent.type(screen.getByRole('textbox'), '  Hello  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('clears the input after sending', async () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(textarea).toHaveValue('')
  })

  it('sends on Enter key', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello{Enter}')
    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('does not send on Shift+Enter', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables input and button when disabled prop is set', () => {
    render(<ChatInput onSend={vi.fn()} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
