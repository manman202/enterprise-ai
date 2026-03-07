import { SearchResult } from '@/api/search'
import { Badge } from '@/components/ui/Badge'

interface SearchResultCardProps {
  result: SearchResult
  rank: number
}

function scoreToBadgeVariant(score: number): 'ok' | 'warning' | 'error' {
  if (score >= 0.7) return 'ok'
  if (score >= 0.4) return 'warning'
  return 'error'
}

export function SearchResultCard({ result, rank }: SearchResultCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-600 shrink-0">#{rank}</span>
          <span className="text-sm font-medium text-gray-100 truncate">{result.filename}</span>
        </div>
        <Badge variant={scoreToBadgeVariant(result.score)}>
          {Math.round(result.score * 100)}% match
        </Badge>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{result.excerpt}</p>
    </div>
  )
}
