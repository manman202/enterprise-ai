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

export interface ServiceDetail {
  status: 'healthy' | 'unhealthy' | 'unknown'
  response_ms: number
  error?: string
  model_loaded?: string
}

export interface SystemMetrics {
  cpu_percent: number
  ram_used_gb: number
  ram_total_gb: number
  ram_percent: number
  disk_used_gb: number
  disk_total_gb: number
  disk_percent: number
  swap_used_gb: number
  swap_total_gb: number
}

export interface DetailedHealthResponse {
  timestamp: string
  services: {
    postgres: ServiceDetail
    chromadb: ServiceDetail
    ollama: ServiceDetail & { model_loaded?: string }
    backend: ServiceDetail
    frontend: ServiceDetail
    admin: ServiceDetail
    gitlab: ServiceDetail
  }
  system: SystemMetrics
}

export const healthApi = {
  check: () =>
    api.get<{ status: string; services: Record<string, { status: string; latency_ms?: number }> }>('/health'),

  detailed: () =>
    api.get<DetailedHealthResponse>('/health/services'),
}
