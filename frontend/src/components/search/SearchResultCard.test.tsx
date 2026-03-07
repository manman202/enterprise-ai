import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchResultCard } from './SearchResultCard'
import type { SearchResult } from '@/api/search'

const result: SearchResult = {
  document_id: 'doc-1',
  filename: 'policy.txt',
  excerpt: 'All employees must comply with the security policy.',
  score: 0.85,
}

describe('SearchResultCard', () => {
  it('renders filename and excerpt', () => {
    render(<SearchResultCard result={result} rank={1} />)
    expect(screen.getByText('policy.txt')).toBeInTheDocument()
    expect(screen.getByText(result.excerpt)).toBeInTheDocument()
  })

  it('renders rank number', () => {
    render(<SearchResultCard result={result} rank={3} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('renders score as a percentage', () => {
    render(<SearchResultCard result={result} rank={1} />)
    expect(screen.getByText('85% match')).toBeInTheDocument()
  })

  it('uses ok badge for high score', () => {
    render(<SearchResultCard result={{ ...result, score: 0.9 }} rank={1} />)
    expect(screen.getByText('90% match')).toHaveClass('text-green-400')
  })

  it('uses warning badge for mid score', () => {
    render(<SearchResultCard result={{ ...result, score: 0.5 }} rank={1} />)
    expect(screen.getByText('50% match')).toHaveClass('text-yellow-400')
  })

  it('uses error badge for low score', () => {
    render(<SearchResultCard result={{ ...result, score: 0.2 }} rank={1} />)
    expect(screen.getByText('20% match')).toHaveClass('text-red-400')
  })
})
