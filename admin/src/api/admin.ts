import { AdminUser } from './auth'
import { api } from './client'

export type { AdminUser }

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users'),

  updateUser: (id: string, patch: { is_active?: boolean; is_admin?: boolean }) =>
    api.patch<AdminUser>(`/admin/users/${id}`, patch),

  deleteUser: (id: string) => api.del<void>(`/admin/users/${id}`),
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  user_id: string | null
  username?: string
  action: string
  resource: string
  outcome: 'allow' | 'deny'
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}

export const auditApi = {
  list: (params?: { user?: string; action?: string; outcome?: string; limit?: number; offset?: number }) =>
    api.get<AuditLog[]>('/admin/audit-logs', params as Record<string, unknown>),
}

// ── Documents / Knowledge ────────────────────────────────────────────────────

export interface Document {
  id: string
  filename: string
  department: string
  file_size: number
  chunks_count: number
  status: 'pending' | 'ingested' | 'failed'
  ingested_at: string | null
  error_message: string | null
}

export const knowledgeApi = {
  listDocuments: () => api.get<Document[]>('/documents/'),
  deleteDocument: (id: string) => api.del<void>(`/documents/${id}`),
  reindex: () => api.post<void>('/documents/reindex', {}),
}

// ── System Health ────────────────────────────────────────────────────────────

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  response_time_ms: number
  uptime_pct: number
}

export const healthApi = {
  check: () =>
    api.get<{ status: string; services: Record<string, { status: string; latency_ms?: number }> }>('/health'),
}
