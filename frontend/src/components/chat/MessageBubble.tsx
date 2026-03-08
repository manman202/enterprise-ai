import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Check } from 'lucide-react'
import { SourceCitation, Source } from './SourceCitation'

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  timestamp?: string
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

export function MessageBubble({ role, content, sources, timestamp }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isUser = role === 'user'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2">
        <div className="flex flex-col items-end max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-[#2563eb] text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
            {content}
          </div>
          {timestamp && (
            <span className="mt-1 text-[10px] text-gray-400">{formatTimestamp(timestamp)}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        A
      </div>
      <div className="flex flex-col max-w-[75%]">
        <div className="relative bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm text-gray-800 leading-relaxed">
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {hovered && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              title="Copy to clipboard"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {sources && sources.length > 0 && (
          <SourceCitation sources={sources} />
        )}
        {timestamp && (
          <span className="mt-1 text-[10px] text-gray-400">{formatTimestamp(timestamp)}</span>
        )}
      </div>
    </div>
  )
}
