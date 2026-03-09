import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Menu, X, Plus, Trash2, Send, MessageSquare } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { Source } from '@/components/chat/SourceCitation'
import { Spinner } from '@/components/ui/Spinner'

interface Conversation {
  id: string
  title: string
  updated_at: string
  message_count: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  created_at?: string
  isStreaming?: boolean
}


interface HistoryResponse {
  messages: ChatMessage[]
}

function groupConversations(convs: Conversation[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of convs) {
    const d = new Date(conv.updated_at)
    if (d >= startOfToday) {
      groups[0].items.push(conv)
    } else if (d >= startOfYesterday) {
      groups[1].items.push(conv)
    } else if (d >= startOfWeek) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

const SUGGESTED_PROMPTS = [
  'Summarize our HR onboarding policy',
  'What are the IT security guidelines?',
  'Show me the latest procurement procedures',
]

export default function ChatPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [convsLoading, setConvsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load conversations on mount
  const loadConversations = useCallback(async () => {
    setConvsLoading(true)
    try {
      const data = await api.get<Conversation[]>('/chat/conversations')
      setConversations(data)
    } catch {
      // silently fail — no conversations yet
    } finally {
      setConvsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Handle ?conv= param from HistoryPage navigation
  useEffect(() => {
    const convId = searchParams.get('conv')
    if (convId) {
      openConversation(convId)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 5 + 24
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [inputValue])

  async function openConversation(id: string) {
    setActiveConvId(id)
    setMessages([])
    setSidebarOpen(false)
    try {
      const data = await api.get<HistoryResponse>(`/chat/history/${id}`)
      setMessages(data.messages)
    } catch {
      setMessages([])
    }
  }

  function startNewConversation() {
    setActiveConvId(null)
    setMessages([])
    setSidebarOpen(false)
    setInputValue('')
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await api.del(`/chat/conversations/${id}`)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConvId === id) {
        setActiveConvId(null)
        setMessages([])
      }
    } catch {
      // ignore
    }
  }

  async function handleSend(content: string) {
    if (!content.trim() || loading) return

    const userMessage: ChatMessage = { role: 'user', content, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    // Placeholder assistant message filled token by token
    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', isStreaming: true, created_at: new Date().toISOString() },
    ])

    const conversationTarget = activeConvId ?? 'new'
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${window.location.host}/ws/chat/${conversationTarget}`

    let resolvedConvId: string | null = null

    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          const token = localStorage.getItem('aiyedun_token') ?? ''
          ws.send(JSON.stringify({ message: content, token }))
        }

        ws.onmessage = (event) => {
          // Try to parse as JSON — it's either a control message or a raw token
          try {
            const data = JSON.parse(event.data)
            if (data.error) {
              reject(new Error(data.error))
              ws.close()
              return
            }
            if (data.done) {
              resolvedConvId = data.conversation_id ?? resolvedConvId
              // Finalise the assistant message: add sources, clear streaming flag
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, sources: data.sources ?? [], isStreaming: false }
                    : m
                )
              )
              ws.close()
              resolve()
              return
            }
          } catch {
            // Not JSON — it's a raw token string
          }
          // Append raw token to last message
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + event.data }
            }
            return updated
          })
        }

        ws.onerror = () => reject(new Error('WebSocket connection failed'))
        ws.onclose = (e) => {
          if (!e.wasClean && e.code !== 1000) {
            reject(new Error(`WebSocket closed unexpectedly (${e.code})`))
          }
        }
      })

      // Update conversation state after stream completes
      if (!activeConvId && resolvedConvId) {
        setActiveConvId(resolvedConvId)
      }
      await loadConversations()
    } catch (err) {
      // Replace the empty assistant placeholder with an error message
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.role === 'assistant'
            ? {
                ...m,
                content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setLoading(false)
      // Ensure streaming flag is cleared even if we exited early
      setMessages((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      )
    }

    // Suppress unused variable warning — assistantId was replaced by index tracking
    void assistantId
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(inputValue)
    }
  }

  const groups = groupConversations(conversations)
  const username = user?.username ?? 'there'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-blue-900/40">
        <span className="text-lg font-extrabold tracking-widest text-white uppercase">AIYEDUN</span>
        {user && (
          <p className="mt-0.5 text-xs text-blue-300 opacity-70 truncate">{user.username}</p>
        )}
      </div>

      {/* New conversation */}
      <div className="px-3 py-3">
        <button
          onClick={startNewConversation}
          className="w-full flex items-center gap-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {convsLoading ? (
          <div className="flex justify-center mt-6">
            <Spinner size="sm" className="text-blue-300" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-blue-300 opacity-50 text-center mt-6 px-4">
            No conversations yet. Start a new one!
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400 opacity-60">
                {group.label}
              </p>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  className={[
                    'group relative flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors text-sm',
                    activeConvId === conv.id
                      ? 'bg-blue-900/50 text-white'
                      : 'text-blue-100 hover:bg-blue-900/30',
                  ].join(' ')}
                  onClick={() => openConversation(conv.id)}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm leading-snug">
                      {conv.title.length > 40 ? conv.title.slice(0, 40) + '…' : conv.title}
                    </p>
                    <p className="text-[10px] opacity-50 mt-0.5">{relativeTime(conv.updated_at)}</p>
                  </div>
                  {hoveredConvId === conv.id && (
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="flex-shrink-0 p-1 rounded hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-colors"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full bg-[#f8fafc] overflow-hidden" style={{ fontFamily: 'system-ui, Inter, sans-serif' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] flex-shrink-0 bg-[#1e3a5f] h-full">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-[260px] bg-[#1e3a5f] h-full z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 text-blue-200 hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-[#1e3a5f]">
            {activeConvId
              ? conversations.find((c) => c.id === activeConvId)?.title ?? 'Conversation'
              : 'New conversation'}
          </h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-2xl font-extrabold mb-6 shadow-lg">
                A
              </div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                Bonjour {username} 👋
              </h2>
              <p className="text-gray-500 text-sm mb-8 max-w-sm">
                Posez votre première question à Aiyedun
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:border-[#2563eb] hover:text-[#2563eb] shadow-sm transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  sources={msg.sources}
                  timestamp={msg.created_at}
                  isStreaming={msg.isStreaming}
                />
              ))}
              {loading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-4">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              placeholder="Ask Aiyedun anything… (Enter to send, Shift+Enter for new line)"
              aria-label="Message input"
              className={[
                'flex-1 resize-none rounded-xl border border-gray-300 bg-[#f8fafc] px-4 py-3',
                'text-sm text-gray-800 placeholder-gray-400 leading-6',
                'focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition min-h-[48px] max-h-[144px] overflow-y-auto',
              ].join(' ')}
            />
            <button
              onClick={() => handleSend(inputValue)}
              disabled={loading || !inputValue.trim()}
              aria-label="Send message"
              className={[
                'flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl',
                'bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {loading ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-gray-400 text-center">
            Aiyedun can make mistakes. Verify important information with your documents.
          </p>
        </div>
      </div>
    </div>
  )
}
