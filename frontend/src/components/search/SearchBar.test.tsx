import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('renders input and search button', () => {
    render(<SearchBar onSearch={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Search query' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('search button is disabled when input is empty', () => {
    render(<SearchBar onSearch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })

  it('enables button when query is typed', async () => {
    render(<SearchBar onSearch={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), 'policy')
    expect(screen.getByRole('button', { name: 'Search' })).not.toBeDisabled()
  })

  it('calls onSearch with trimmed query on submit', async () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    await userEvent.type(screen.getByRole('textbox'), '  annual report  ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).toHaveBeenCalledWith('annual report')
  })

  it('does not call onSearch for whitespace-only query', async () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    await userEvent.type(screen.getByRole('textbox'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('shows spinner and disables controls when loading', () => {
    render(<SearchBar onSearch={vi.fn()} loading />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })
})
