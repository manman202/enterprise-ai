import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
}

export function SearchBar({ onSearch, loading = false }: SearchBarProps) {
  const [query, setQuery] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    onSearch(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your knowledge base…"
        aria-label="Search query"
        className={[
          'flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5',
          'text-sm text-gray-100 placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
        ].join(' ')}
      />
      <Button type="submit" disabled={!query.trim()} loading={loading}>
        Search
      </Button>
    </form>
  )
}
