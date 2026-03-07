import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchPage from './SearchPage'
import * as searchModule from '@/api/search'

vi.mock('@/api/search', () => ({
  searchApi: { search: vi.fn() },
}))

const mockSearch = vi.mocked(searchModule.searchApi.search)

const hit = {
  document_id: 'doc-1',
  filename: 'notes.txt',
  excerpt: 'Some relevant content here.',
  score: 0.9,
}

function renderPage() {
  return render(<MemoryRouter><SearchPage /></MemoryRouter>)
}

beforeEach(() => mockSearch.mockReset())

describe('SearchPage', () => {
  it('shows no results area before first search', () => {
    renderPage()
    expect(screen.queryByText(/results for/i)).not.toBeInTheDocument()
  })

  it('displays results after a successful search', async () => {
    mockSearch.mockResolvedValue({ query: 'notes', results: [hit] })
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'notes')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument())
    expect(screen.getByText('1 result for "notes"')).toBeInTheDocument()
  })

  it('shows plural result count', async () => {
    mockSearch.mockResolvedValue({ query: 'q', results: [hit, { ...hit, document_id: 'doc-2', filename: 'other.txt' }] })
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'q')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('2 results for "q"')).toBeInTheDocument())
  })

  it('shows no-results message when empty', async () => {
    mockSearch.mockResolvedValue({ query: 'xyz', results: [] })
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'xyz')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('No results for "xyz"')).toBeInTheDocument())
  })

  it('shows error on failure', async () => {
    mockSearch.mockRejectedValue(new Error('503 Service Unavailable'))
    renderPage()
    await userEvent.type(screen.getByRole('textbox'), 'fail')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByText('503 Service Unavailable')).toBeInTheDocument())
  })
})
