import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { Source } from '../api/client'

interface Props {
  sources: Source[]
}

const MAX_VISIBLE = 3

export function SourceCitation({ sources }: Props) {
  const [tooltip, setTooltip] = useState<number | null>(null)

  if (!sources || sources.length === 0) return null

  const visible = sources.slice(0, MAX_VISIBLE)
  const overflow = sources.length - MAX_VISIBLE

  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {visible.map((src, i) => {
        const name = src.filename.length > 20 ? src.filename.slice(0, 19) + '…' : src.filename
        return (
          <div
            key={i}
            onMouseEnter={() => setTooltip(i)}
            onMouseLeave={() => setTooltip(null)}
            style={{ position: 'relative' }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                background: 'var(--color-surface-2, #f1f5f9)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: 20,
                fontSize: 10,
                color: 'var(--color-text-muted, #64748b)',
                cursor: 'default',
                maxWidth: 180,
              }}
            >
              <FileText size={9} style={{ flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 100,
                }}
              >
                {name}
              </span>
              {src.department && (
                <span
                  style={{
                    background: 'var(--color-primary, #1e3a5f)',
                    color: '#fff',
                    borderRadius: 3,
                    padding: '0 4px',
                    fontSize: 9,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {src.department.length > 8 ? src.department.slice(0, 7) + '…' : src.department}
                </span>
              )}
            </div>

            {/* Tooltip */}
            {tooltip === i && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 4,
                  background: '#1e293b',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 10,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  maxWidth: 220,
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{src.filename}</div>
                {src.department && (
                  <div style={{ color: '#94a3b8' }}>Dept: {src.department}</div>
                )}
                {src.score != null && (
                  <div style={{ color: '#94a3b8' }}>
                    Relevance: {(src.score * 100).toFixed(0)}%
                  </div>
                )}
                {src.chunk_text && (
                  <div
                    style={{
                      marginTop: 3,
                      color: '#cbd5e1',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      maxWidth: 200,
                      whiteSpace: 'normal',
                    }}
                  >
                    {src.chunk_text}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {overflow > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            background: 'var(--color-surface-2, #f1f5f9)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: 20,
            fontSize: 10,
            color: 'var(--color-text-muted, #64748b)',
          }}
        >
          +{overflow} more
        </div>
      )}
    </div>
  )
}
