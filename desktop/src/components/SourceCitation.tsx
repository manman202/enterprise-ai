import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import type { Source } from '../api/client'

interface Props {
  sources: Source[]
}

export function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!sources || sources.length === 0) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--color-text-muted)',
          padding: '2px 0',
        }}
      >
        <FileText size={11} />
        {sources.length} source{sources.length !== 1 ? 's' : ''}
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sources.map((src, i) => (
            <div
              key={i}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: '4px 8px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  marginBottom: src.chunk_text ? 2 : 0,
                }}
              >
                {src.filename}
              </div>
              {src.chunk_text && (
                <div
                  className="selectable"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {src.chunk_text}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
