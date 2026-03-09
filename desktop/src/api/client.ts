import axios, { AxiosError } from 'axios'
import { invoke } from '@tauri-apps/api/core'

// ── Server URL resolution ──────────────────────────────────────────────────────

let _serverUrl = ''

export async function initServerUrl(): Promise<string> {
  try {
    const stored = await invoke<string | null>('get_server_url')
    _serverUrl = stored ?? 'https://api.aiyedun.online'
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
      // Token expired — clear and reload
      invoke('clear_auth').catch(() => {})
      window.location.hash = '#/login'
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────

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

export async function login(username: string, password: string): Promise<LoginResponse> {
  const params = new URLSearchParams({ username, password })
  const res = await http.post<LoginResponse>('/api/v1/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export async function me(): Promise<UserInfo> {
  const res = await http.get<UserInfo>('/api/v1/auth/me')
  return res.data
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  created_at: string
}

export interface Source {
  filename: string
  chunk_text?: string
  score?: number
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await http.get<Conversation[]>('/api/v1/conversations')
  return res.data
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const res = await http.get<Message[]>(`/api/v1/conversations/${conversationId}/messages`)
  return res.data
}

export async function deleteConversation(id: string): Promise<void> {
  await http.delete(`/api/v1/conversations/${id}`)
}

// ── WebSocket chat ────────────────────────────────────────────────────────────

export function createChatWebSocket(
  conversationId: string | null,
  onMessage: (data: WsMessage) => void,
  onError: (err: Event) => void,
): WebSocket {
  const wsBase = _serverUrl.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  const url = `${wsBase}/api/v1/chat/ws`
  const ws = new WebSocket(url)

  ws.onopen = async () => {
    const token = await invoke<string | null>('get_token').catch(() => null)
    ws.send(JSON.stringify({ type: 'auth', token }))
    if (conversationId) {
      ws.send(JSON.stringify({ type: 'resume', conversation_id: conversationId }))
    }
  }

  ws.onmessage = (event) => {
    try {
      const data: WsMessage = JSON.parse(event.data)
      onMessage(data)
    } catch { /* ignore malformed */ }
  }

  ws.onerror = onError
  return ws
}

export type WsMessage =
  | { type: 'token'; content: string }
  | { type: 'done'; conversation_id: string; message_id: string; sources: Source[] }
  | { type: 'error'; message: string }
  | { type: 'auth_ok' }
  | { type: 'auth_error'; message: string }
