export type Role = 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-blue-600 text-white'
            : 'rounded-bl-sm bg-gray-800 text-gray-100',
        ].join(' ')}
      >
        <span className="mb-1 block text-xs font-medium opacity-60">
          {isUser ? 'You' : 'Aiyedun'}
        </span>
        {message.content}
      </div>
    </div>
  )
}
