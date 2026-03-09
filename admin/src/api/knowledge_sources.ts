/**
 * Knowledge Sources API client — typed wrappers for the /api/v1/knowledge-sources endpoints.
 */

import { api } from './client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SourceType = 'sharepoint' | 'smb' | 'exchange' | 'local' | 's3'

export type SourceStatus = 'active' | 'inactive' | 'error' | 'syncing'

export interface KnowledgeSource {
  id: string
  name: string
  department: string | null
  source_type: SourceType
  config: Record<string, unknown> | null
  status: SourceStatus
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_count: number | null
  last_error: string | null
  created_at: string
  created_by: string | null
}

export interface SyncHistoryEntry {
  id: string
  source_id: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  files_processed: number | null
  status: 'success' | 'failed' | 'partial'
  error: string | null
}

export interface TestConnectionResult {
  success: boolean
  message: string
  files_found?: number
}

export interface KnowledgeSourceCreate {
  name: string
  department?: string
  source_type: SourceType
  config: Record<string, unknown>
  is_active?: boolean
}

export interface KnowledgeSourceUpdate {
  name?: string
  department?: string
  status?: SourceStatus
  config?: Record<string, unknown>
  is_active?: boolean
}

export interface KnowledgeStats {
  total_sources: number
  active_sources: number
  last_sync: string | null
  documents_indexed: number
}

// ── API client ─────────────────────────────────────────────────────────────────

export const knowledgeSourcesApi = {
  stats: () =>
    api.get<KnowledgeStats>('/knowledge-sources/stats'),

  list: () =>
    api.get<KnowledgeSource[]>('/knowledge-sources'),

  get: (id: string) =>
    api.get<KnowledgeSource>(`/knowledge-sources/${id}`),

  create: (body: KnowledgeSourceCreate) =>
    api.post<KnowledgeSource>('/knowledge-sources', body),

  update: (id: string, body: KnowledgeSourceUpdate) =>
    api.patch<KnowledgeSource>(`/knowledge-sources/${id}`, body),

  delete: (id: string) =>
    api.del<void>(`/knowledge-sources/${id}`),

  sync: (id: string) =>
    api.post<{ message: string; source_id: string }>(`/knowledge-sources/${id}/sync`, {}),

  syncHistory: (id: string) =>
    api.get<SyncHistoryEntry[]>(`/knowledge-sources/${id}/sync-history`),

  testConnection: (source_type: SourceType, config: Record<string, unknown>) =>
    api.post<TestConnectionResult>('/knowledge-sources/test-connection', { source_type, config }),
}
