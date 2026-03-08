/**
 * Analytics API client — typed wrappers for /api/v1/analytics endpoints.
 */

import { api } from './client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  queries_today: number
  queries_this_week: number
  active_users_today: number
  active_users_this_week: number
  total_conversations: number
  avg_response_time_ms: number
  no_answer_rate: number
  documents_indexed: number
}

export interface HourlyQueryPoint {
  hour: string
  label: string
  count: number
}

export interface DeptQueryPoint {
  department: string
  count: number
}

export interface TopDocument {
  filename: string
  department: string
  citation_count: number
}

export interface DailyActiveUsersPoint {
  date: string
  count: number
}

export interface ResponseTimePoint {
  hour: string
  label: string
  avg_ms: number | null
}

// ── API client ─────────────────────────────────────────────────────────────────

export const analyticsApi = {
  overview: () =>
    api.get<AnalyticsOverview>('/analytics/overview'),

  queriesPerHour: () =>
    api.get<HourlyQueryPoint[]>('/analytics/queries-per-hour'),

  queriesPerDepartment: (days = 7) =>
    api.get<DeptQueryPoint[]>('/analytics/queries-per-department', { days }),

  topDocuments: (days = 30) =>
    api.get<TopDocument[]>('/analytics/top-documents', { days }),

  dailyActiveUsers: (days = 30) =>
    api.get<DailyActiveUsersPoint[]>('/analytics/daily-active-users', { days }),

  responseTimes: () =>
    api.get<ResponseTimePoint[]>('/analytics/response-times'),
}
