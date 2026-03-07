import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChatPage from './ChatPage'
import * as client from '@/api/client'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const mockPost = vi.mocked(client.api.post)

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>,
  )
}

beforeEach(() => mockPost.mockReset())

describe('ChatPage', () => {
  it('shows an empty state prompt initially', () => {
    renderPage()
    expect(screen.getByText(/ask aiyedun anything/i)).toBeInTheDocument()
  })

  it('displays the user message after sending', async () => {
    mockPost.mockResolvedValue({ response: 'Hello!' })
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'Hi there')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('displays the assistant response', async () => {
    mockPost.mockResolvedValue({ response: 'I am Aiyedun.' })
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'Who are you?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('I am Aiyedun.')).toBeInTheDocument())
  })

  it('shows a thinking indicator while loading', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'Ping')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
  })

  it('disables input while loading', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'Ping')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('shows an error message on failure', async () => {
    mockPost.mockRejectedValue(new Error('503 Service Unavailable'))
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('503 Service Unavailable')).toBeInTheDocument())
  })
})
