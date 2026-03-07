import { useState } from 'react'
import { SearchResponse, searchApi } from '@/api/search'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResultCard } from '@/components/search/SearchResultCard'

export default function SearchPage() {
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(query: string) {
    setLoading(true)
    setError(null)
    try {
      setResponse(await searchApi.search(query))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Search" />

      <div className="mb-6">
        <SearchBar onSearch={handleSearch} loading={loading} />
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {response && (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            {response.results.length === 0
              ? `No results for "${response.query}"`
              : `${response.results.length} result${response.results.length !== 1 ? 's' : ''} for "${response.query}"`}
          </p>
          <div className="flex flex-col gap-3">
            {response.results.map((result, i) => (
              <SearchResultCard key={result.document_id} result={result} rank={i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
