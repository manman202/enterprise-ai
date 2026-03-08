import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'

export interface Source {
  document_id: string
  filename: string
  department: string
  score: number
}

interface SourceCitationProps {
  sources: Source[]
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false)

  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>Sources ({sources.length})</span>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sources.map((source) => {
            const displayName =
              source.filename.length > 30
                ? source.filename.slice(0, 30) + '…'
                : source.filename
            const scorePercent = (source.score * 100).toFixed(1)

            return (
              <div
                key={source.document_id}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
              >
                <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{displayName}</span>
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700 text-[10px] font-semibold">
                  {source.department}
                </span>
                <span className="text-gray-400">{scorePercent}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
