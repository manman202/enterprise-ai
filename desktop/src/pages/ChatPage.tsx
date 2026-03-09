import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Plus, History, Settings, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  getMessages,
  createChatWebSocket,
  Source,
  WsMessage,
} from '../api/client'
import { SourceCitation } from '../components/SourceCitation'
import { HistoryPanel } from './HistoryPanel'
import { SettingsPanel } from './SettingsPanel'
import { NotificationManager } from '../components/NotificationManager'

interface Props {
  onLogout: () => void
}

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  streaming?: boolean
}

export function ChatPage({ onLogout }: Props) {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingNotif, setPendingNotif] = useState<{ title: string; body: string } | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close WS on unmount
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  function loadConversation(id: string) {
    setConversationId(id)
    setMessages([])
    getMessages(id)
      .then((msgs) => {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
          })),
        )
      })
      .catch(() => {})
  }

  function newConversation() {
    wsRef.current?.close()
    wsRef.current = null
    setConversationId(null)
    setMessages([])
    setSending(false)
    textareaRef.current?.focus()
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userMsg: LocalMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])

    // Placeholder for streaming AI response
    const aiId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: aiId, role: 'assistant', content: '', streaming: true },
    ])

    // Close previous WS
    wsRef.current?.close()

    const ws = createChatWebSocket(
      conversationId,
      (data: WsMessage) => {
        if (data.type === 'token') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId ? { ...m, content: m.content + data.content } : m,
            ),
          )
        } else if (data.type === 'done') {
          setConversationId(data.conversation_id)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, sources: data.sources, streaming: false }
                : m,
            ),
          )
          setSending(false)
          // Fire notification if window not focused
          setPendingNotif({ title: 'Aiyedun', body: 'Response ready' })
        } else if (data.type === 'error') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, content: data.message, streaming: false }
                : m,
            ),
          )
          setSending(false)
        }
      },
      () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: 'Connection error. Please try again.', streaming: false }
              : m,
          ),
        )
        setSending(false)
      },
    )

    // Send query once auth ok
    const origOnMessage = ws.onmessage
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'auth_ok') {
          ws.send(JSON.stringify({ type: 'query', content: text }))
          ws.onmessage = origOnMessage
        } else {
          // Re-route to original handler
          if (origOnMessage) (origOnMessage as (e: MessageEvent) => void)(event)
        }
      } catch { /* ignore */ }
    }

    wsRef.current = ws
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function adjustTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
  }

  const consumeNotif = useCallback(() => setPendingNotif(null), [])

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', position: 'relative' }}>

      <NotificationManager pendingNotification={pendingNotif} onConsumed={consumeNotif} />

      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'var(--color-primary)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          A
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
            Aiyedun
          </div>
          {user && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>
              {user.username}
            </div>
          )}
        </div>

        <button
          onClick={newConversation}
          title="New conversation"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 4 }}
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setShowHistory(true)}
          title="History"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 4 }}
        >
          <History size={16} />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 4 }}
        >
          <Settings size={16} />
        </button>
      </div>

      {/* ── Messages area ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-faint)',
              fontSize: 12,
              gap: 8,
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              A
            </div>
            <div>Ask me anything about your organisation</div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '6px 8px',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustTextarea(e.target)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            disabled={sending}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--color-text)',
              lineHeight: 1.5,
              maxHeight: 100,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: input.trim() && !sending ? 'var(--color-primary)' : 'var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            {sending ? (
              <Loader2 size={13} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send size={13} style={{ color: input.trim() ? '#fff' : 'var(--color-text-faint)' }} />
            )}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-faint)', marginTop: 4, paddingLeft: 2 }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      {/* ── Slide-in panels ── */}
      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onSelect={loadConversation}
          currentId={conversationId}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function MessageBubble({ msg }: { msg: LocalMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          padding: '7px 11px',
          borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
          background: isUser ? 'var(--color-user-bubble)' : 'var(--color-ai-bubble)',
          color: isUser ? 'var(--color-user-text)' : 'var(--color-ai-text)',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div className="selectable" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.content}
          {msg.streaming && (
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 14,
                background: 'var(--color-accent)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                borderRadius: 1,
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
        </div>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <SourceCitation sources={msg.sources} />
        )}
      </div>
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
