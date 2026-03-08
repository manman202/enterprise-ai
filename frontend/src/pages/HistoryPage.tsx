import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ExternalLink, Trash2, MessageSquare } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'

interface Conversation {
  id: string
  title: string
  updated_at: string
  message_count: number
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true)
      try {
        const data = await api.get<Conversation[]>('/chat/conversations')
        setConversations(data)
      } catch {
        setConversations([])
      } finally {
        setLoading(false)
      }
    }
    fetchConversations()
  }, [])

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Delete this conversation? This action cannot be undone.')
    if (!confirmed) return
    try {
      await api.del(`/chat/conversations/${id}`)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // ignore
    }
  }

  function handleOpen(id: string) {
    navigate(`/chat?conv=${id}`)
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title="Conversation History" />

      {/* Search bar */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">
            {conversations.length === 0
              ? 'No conversations yet'
              : 'No conversations match your search'}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {conversations.length === 0
              ? 'Start chatting to create your first conversation.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-400">Title</th>
                <th className="px-4 py-3 font-medium text-gray-400 w-24 text-right">Messages</th>
                <th className="px-4 py-3 font-medium text-gray-400 w-44">Date</th>
                <th className="px-4 py-3 font-medium text-gray-400 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((conv) => (
                <tr
                  key={conv.id}
                  className="bg-gray-950 hover:bg-gray-900/60 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-100 font-medium">
                    <span className="line-clamp-1">{conv.title}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-right tabular-nums">
                    {conv.message_count}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {formatDate(conv.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpen(conv.id)}
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                        title="Open conversation"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </button>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="flex items-center gap-1.5 rounded-md bg-gray-800 hover:bg-red-700 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 transition-colors"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-600">
        {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </p>
    </div>
  )
}
