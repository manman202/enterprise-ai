import { useState, useEffect, useMemo } from 'react'
import { X, MessageSquare, Trash2, Search } from 'lucide-react'
import { getConversations, deleteConversation, Conversation } from '../api/client'

interface Props {
  onClose: () => void
  onSelect: (id: string) => void
  currentId: string | null
}

export function HistoryPanel({ onClose, onSelect, currentId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getConversations()
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        setConversations(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return conversations
    return conversations.filter((c) =>
      (c.title || '').toLowerCase().includes(q),
    )
  }, [conversations, query])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await deleteConversation(id).catch(() => {})
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-surface)', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-primary)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Conversation History</span>
        <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)' }}><X size={16} /></button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '5px 9px' }}>
          <Search size={12} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--color-text)' }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-faint)', fontSize: 12 }}>Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-faint)', fontSize: 12 }}>
            {query ? 'No matching conversations' : 'No conversations yet'}
          </div>
        )}
        {filtered.map((conv) => (
          <div
            key={conv.id}
            onClick={() => { onSelect(conv.id); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: conv.id === currentId ? 'var(--color-surface-2)' : 'transparent', borderLeft: conv.id === currentId ? '2px solid var(--color-primary)' : '2px solid transparent' }}
          >
            <MessageSquare size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.title || 'Untitled conversation'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-faint)', marginTop: 1, display: 'flex', gap: 6 }}>
                <span>{formatDate(conv.updated_at)}</span>
                {conv.message_count != null && <span>{conv.message_count} msgs</span>}
              </div>
            </div>
            <button onClick={(e) => handleDelete(e, conv.id)} style={{ color: 'var(--color-text-faint)', flexShrink: 0, padding: 2 }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
