import { FormEvent, KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) return
      onSend(trimmed)
      setValue('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
        aria-label="Message"
        className={[
          'flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3',
          'text-sm text-gray-100 placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      />
      <Button type="submit" disabled={disabled || !value.trim()} className="mb-0.5">
        Send
      </Button>
    </form>
  )
}
