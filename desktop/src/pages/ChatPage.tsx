import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Plus,
  History,
  Settings,
  Loader2,
  Paperclip,
  X,
  Copy,
  Check,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  getHistory,
  streamMessage,
  Source,
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

const SUGGESTED = [
  'What are our HR policies?',
  "Summarise last quarter's report",
  'Who do I contact for IT support?',
]

export function ChatPage({ onLogout }: Props) {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingNotif, setPendingNotif] = useState<{ title: string; body: string } | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const cancelRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { cancelRef.current?.() }
  }, [])

  function loadConversation(id: string) {
    cancelRef.current?.()
    setConversationId(id)
    setMessages([])
    setSending(false)
    getHistory(id)
      .then((msgs) => setMessages(msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
      }))))
      .catch(() => {})
  }

  function newConversation() {
    cancelRef.current?.()
    setConversationId(null)
    setMessages([])
    setSending(false)
    setAttachedFile(null)
    textareaRef.current?.focus()
  }

  async function sendMsg(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setInput('')
    setAttachedFile(null)
    setSending(true)

    const userMsg: LocalMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])

    const aiId = `a-${Date.now()}`
    setMessages((prev) => [...prev, { id: aiId, role: 'assistant', content: '', streaming: true }])

    cancelRef.current?.()
    const cancel = streamMessage(
      trimmed,
      conversationId,
      (token) => {
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, content: m.content + token } : m),
        )
      },
      (convId, sources) => {
        setConversationId(convId)
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, sources, streaming: false } : m),
        )
        setSending(false)
        setPendingNotif({ title: 'Aiyedun replied', body: '' /* filled below */ })
      },
      (errMsg) => {
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, content: errMsg, streaming: false } : m),
        )
        setSending(false)
      },
    )
    cancelRef.current = cancel
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg(input)
    }
  }

  function adjustTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setAttachedFile(file)
    e.target.value = ''
  }

  const consumeNotif = useCallback(() => setPendingNotif(null), [])
  const charCount = input.length

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>

      <NotificationManager
        pendingNotification={pendingNotif}
        onConsumed={consumeNotif}
      />

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-primary)', flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          A
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Aiyedun</div>
          {user && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>{user.username} · {user.department}</div>}
        </div>
        <button onClick={newConversation} title="New conversation" style={iconBtnStyle}><Plus size={16} /></button>
        <button onClick={() => setShowHistory(true)} title="History" style={iconBtnStyle}><History size={16} /></button>
        <button onClick={() => setShowSettings(true)} title="Settings" style={iconBtnStyle}><Settings size={16} /></button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 10 }}>A</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
              Bonjour{user ? ` ${user.username}` : ''} 👋
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Comment puis-je vous aider ?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 300 }}>
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMsg(q)}
                  style={{ padding: '7px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'left', cursor: 'pointer' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Attached file chip ── */}
      {attachedFile && (
        <div style={{ padding: '0 10px 4px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, fontSize: 11, color: '#1e40af' }}>
            <Paperclip size={10} />
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} style={{ color: '#3b82f6' }}><X size={11} /></button>
          </div>
        </div>
      )}

      {/* ── Input area ── */}
      <div style={{ padding: '6px 10px 8px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '6px 8px' }}>
          <button onClick={() => fileInputRef.current?.click()} title="Attach file" style={{ color: 'var(--color-text-faint)', padding: '2px', flexShrink: 0 }}>
            <Paperclip size={15} />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextarea(e.target) }}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            disabled={sending}
            style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            onClick={() => sendMsg(input)}
            disabled={!input.trim() || sending}
            style={{ width: 28, height: 28, borderRadius: 8, background: input.trim() && !sending ? 'var(--color-primary)' : 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
          >
            {sending
              ? <Loader2 size={13} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
              : <Send size={13} style={{ color: input.trim() ? '#fff' : 'var(--color-text-faint)' }} />
            }
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, paddingLeft: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Enter · Shift+Enter for newline</span>
          {charCount >= 500 && <span style={{ fontSize: 10, color: charCount > 800 ? '#ef4444' : 'var(--color-text-faint)' }}>{charCount}</span>}
        </div>
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Panels ── */}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} onSelect={loadConversation} currentId={conversationId} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={onLogout} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: LocalMessage }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  function copyText() {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-end' }}>
      {!isUser && (
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, marginBottom: 2 }}>
          A
        </div>
      )}
      <div style={{ maxWidth: '78%', position: 'relative' }} className="msg-group">
        <div
          style={{
            padding: '7px 11px',
            borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
            background: isUser ? '#2563eb' : 'var(--color-surface)',
            color: isUser ? '#fff' : 'var(--color-text)',
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
          }}
        >
          <div className="selectable" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {msg.content}
            {msg.streaming && (
              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4, verticalAlign: 'middle' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-text-muted)', display: 'inline-block', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </span>
            )}
          </div>
          {!isUser && msg.sources && msg.sources.length > 0 && (
            <SourceCitation sources={msg.sources} />
          )}
        </div>
        {/* Copy button — shown on hover via CSS */}
        {!isUser && !msg.streaming && msg.content && (
          <button
            onClick={copyText}
            className="copy-btn"
            title="Copy"
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.15s',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {copied ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} style={{ color: 'var(--color-text-muted)' }} />}
          </button>
        )}
      </div>

      <style>{`
        .msg-group:hover .copy-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.7)',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
