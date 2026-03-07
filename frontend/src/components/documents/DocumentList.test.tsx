import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentList } from './DocumentList'
import type { Document } from '@/api/documents'

const doc: Document = {
  id: 'doc-1',
  filename: 'notes.txt',
  size: 2048,
  created_at: '2026-01-15T10:00:00Z',
}

describe('DocumentList', () => {
  it('shows empty state when no documents', () => {
    render(<DocumentList documents={[]} onDelete={vi.fn()} deleting={null} />)
    expect(screen.getByText('No documents yet.')).toBeInTheDocument()
  })

  it('renders document filename, size, and date', () => {
    render(<DocumentList documents={[doc]} onDelete={vi.fn()} deleting={null} />)
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('calls onDelete with the document id', async () => {
    const onDelete = vi.fn()
    render(<DocumentList documents={[doc]} onDelete={onDelete} deleting={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('doc-1')
  })

  it('shows loading spinner on the deleting row', () => {
    render(<DocumentList documents={[doc]} onDelete={vi.fn()} deleting="doc-1" />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})
