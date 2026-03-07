import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DocumentsPage from './DocumentsPage'
import * as docsApi from '@/api/documents'

vi.mock('@/api/documents', () => ({
  documentsApi: {
    list: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockList = vi.mocked(docsApi.documentsApi.list)
const mockUpload = vi.mocked(docsApi.documentsApi.upload)
const mockDelete = vi.mocked(docsApi.documentsApi.delete)

const doc = { id: 'doc-1', filename: 'notes.txt', size: 100, created_at: '2026-01-01T00:00:00Z' }

function renderPage() {
  return render(<MemoryRouter><DocumentsPage /></MemoryRouter>)
}

beforeEach(() => {
  mockList.mockReset()
  mockUpload.mockReset()
  mockDelete.mockReset()
})

describe('DocumentsPage', () => {
  it('shows loading then document list', async () => {
    mockList.mockResolvedValue([doc])
    renderPage()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument())
  })

  it('shows empty state when no documents', async () => {
    mockList.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('No documents yet.')).toBeInTheDocument())
  })

  it('shows error when list fails', async () => {
    mockList.mockRejectedValue(new Error('503 unavailable'))
    renderPage()
    await waitFor(() => expect(screen.getByText('503 unavailable')).toBeInTheDocument())
  })

  it('adds uploaded document to list', async () => {
    mockList.mockResolvedValue([])
    mockUpload.mockResolvedValue(doc)
    renderPage()
    await waitFor(() => expect(screen.getByText('No documents yet.')).toBeInTheDocument())

    const file = new File(['content'], 'notes.txt', { type: 'text/plain' })
    await userEvent.upload(screen.getByLabelText('File'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument())
  })

  it('removes deleted document from list', async () => {
    mockList.mockResolvedValue([doc])
    mockDelete.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('notes.txt')).not.toBeInTheDocument())
  })
})
