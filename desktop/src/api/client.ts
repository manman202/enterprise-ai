import axios, { AxiosError } from 'axios'
import { invoke } from '@tauri-apps/api/core'

// ── Server URL resolution ──────────────────────────────────────────────────────

let _serverUrl = ''

export async function initServerUrl(): Promise<string> {
  try {
    const stored = await invoke<string | null>('get_server_url')
    _serverUrl = stored ?? import.meta.env.VITE_DEFAULT_SERVER_URL ?? 'https://api.aiyedun.online'
  } catch {
    _serverUrl = 'https://api.aiyedun.online'
  }
  return _serverUrl
}

export function getServerUrl(): string {
  return _serverUrl
}

export async function setServerUrl(url: string): Promise<void> {
  _serverUrl = url.replace(/\/$/, '')
  await invoke('save_server_url', { url: _serverUrl })
}

// ── Axios instance ────────────────────────────────────────────────────────────

const http = axios.create({ timeout: 30000 })

http.interceptors.request.use(async (config) => {
  try {
    const token = await invoke<string | null>('get_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch { /* no token */ }
  config.baseURL = _serverUrl
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      invoke('clear_auth').catch(() => {})
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    return Promise.reject(err)
  },
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  department: string
  is_admin: boolean
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count?: number
}

export interface Source {
  filename: string
  department?: string
  chunk_text?: string
  score?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  created_at: string
}

export interface ChatMessageResponse {
  conversation_id: string
  message_id: string
  content: string
  sources?: Source[]
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<LoginResponse> {
  const params = new URLSearchParams({ username, password })
  const res = await http.post<LoginResponse>('/api/v1/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  await invoke('save_token', { token: res.data.access_token })
  return res.data
}

export async function logout(): Promise<void> {
  await invoke('clear_auth').catch(() => {})
}

export async function getMe(): Promise<UserInfo> {
  const res = await http.get<UserInfo>('/api/v1/auth/me')
  return res.data
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  conversationId?: string | null,
): Promise<ChatMessageResponse> {
  const res = await http.post<ChatMessageResponse>('/api/v1/chat/message', {
    message,
    conversation_id: conversationId ?? null,
  })
  return res.data
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await http.get<Conversation[]>('/api/v1/conversations')
  return res.data
}

export async function getHistory(conversationId: string): Promise<Message[]> {
  const res = await http.get<Message[]>(`/api/v1/conversations/${conversationId}/messages`)
  return res.data
}

export async function deleteConversation(id: string): Promise<void> {
  await http.delete(`/api/v1/conversations/${id}`)
}

export async function uploadFile(sourceId: string, files: File[]): Promise<void> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  await http.post(`/api/v1/knowledge-sources/${sourceId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ── WebSocket streaming ────────────────────────────────────────────────────────

export type WsMessage =
  | { type: 'token'; content: string }
  | { type: 'done'; conversation_id: string; message_id: string; sources: Source[] }
  | { type: 'error'; message: string }
  | { type: 'auth_ok' }
  | { type: 'auth_error'; message: string }

export function streamMessage(
  message: string,
  conversationId: string | null,
  onToken: (token: string) => void,
  onDone: (convId: string, sources: Source[]) => void,
  onError: (msg: string) => void,
): () => void {
  const wsBase = _serverUrl.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  const ws = new WebSocket(`${wsBase}/api/v1/chat/ws`)

  ws.onopen = async () => {
    const token = await invoke<string | null>('get_token').catch(() => null)
    ws.send(JSON.stringify({ type: 'auth', token }))
    if (conversationId) ws.send(JSON.stringify({ type: 'resume', conversation_id: conversationId }))
  }

  ws.onmessage = (event) => {
    let data: WsMessage
    try { data = JSON.parse(event.data) } catch { return }

    if (data.type === 'auth_ok') {
      ws.send(JSON.stringify({ type: 'query', content: message }))
    } else if (data.type === 'token') {
      onToken(data.content)
    } else if (data.type === 'done') {
      onDone(data.conversation_id, data.sources)
      ws.close()
    } else if (data.type === 'error') {
      onError(data.message)
      ws.close()
    } else if (data.type === 'auth_error') {
      onError('Authentication failed')
      ws.close()
    }
  }

  ws.onerror = () => onError('Connection error')

  return () => ws.close()
}
