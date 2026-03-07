import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatMessage, Message } from '@/components/chat/ChatMessage'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(content: string) {
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content }])
    setLoading(true)

    try {
      const data = await api.post<{ response: string }>('/chat', { message: content })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <PageHeader title="Chat" />

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500 mt-16">
            Ask Aiyedun anything about your knowledge base.
          </p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-2.5 text-sm text-gray-400">
              Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
