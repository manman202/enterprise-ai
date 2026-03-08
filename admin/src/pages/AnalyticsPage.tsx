/**
 * Analytics page — real data from /api/v1/analytics/* endpoints.
 * All charts show empty state when no data exists (no placeholder numbers).
 */

import { useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import {
  analyticsApi,
  AnalyticsOverview,
  HourlyQueryPoint,
  DeptQueryPoint,
  TopDocument,
  DailyActiveUsersPoint,
  ResponseTimePoint,
} from '@/api/analytics'

// ── Constants ─────────────────────────────────────────────────────────────────

type Range = '7' | '30' | '90'

const PIE_COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

// ── Empty state component ─────────────────────────────────────────────────────

function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30')
  const days = parseInt(range, 10)

  // Loading state
  const [loading, setLoading] = useState(true)

  // Data state
  const [overview,    setOverview]    = useState<AnalyticsOverview | null>(null)
  const [hourly,      setHourly]      = useState<HourlyQueryPoint[]>([])
  const [deptData,    setDeptData]    = useState<DeptQueryPoint[]>([])
  const [topDocs,     setTopDocs]     = useState<TopDocument[]>([])
  const [dau,         setDau]         = useState<DailyActiveUsersPoint[]>([])
  const [rtData,      setRtData]      = useState<ResponseTimePoint[]>([])
  const [error,       setError]       = useState<string | null>(null)

  // Thin out x-axis labels so they don't overlap
  const xInterval = days <= 7 ? 0 : days <= 30 ? 4 : 14

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [ov, hq, dq, td, dauData, rt] = await Promise.allSettled([
        analyticsApi.overview(),
        analyticsApi.queriesPerHour(),
        analyticsApi.queriesPerDepartment(days),
        analyticsApi.topDocuments(days),
        analyticsApi.dailyActiveUsers(days),
        analyticsApi.responseTimes(),
      ])

      if (ov.status === 'fulfilled')  setOverview(ov.value)
      if (hq.status === 'fulfilled')  setHourly(hq.value)
      if (dq.status === 'fulfilled')  setDeptData(dq.value)
      if (td.status === 'fulfilled')  setTopDocs(td.value)
      if (dauData.status === 'fulfilled') setDau(dauData.value)
      if (rt.status === 'fulfilled')  setRtData(rt.value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if all data is empty
  const hasAnyActivity = overview
    ? (overview.queries_today > 0 || overview.queries_this_week > 0 || overview.total_conversations > 0)
    : false

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Analytics" />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Date range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Range:</span>
        {(['7', '30', '90'] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              range === r
                ? 'bg-[#1e3a5f] text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            ].join(' ')}
          >
            {r}d
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : !hasAnyActivity ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-24 shadow-sm">
          <BarChart2 size={48} className="mb-4 text-gray-200" />
          <p className="text-base font-medium text-gray-600">No activity yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Data will appear here once users start using Aiyedun.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Queries Today"        value={overview?.queries_today ?? 0} />
            <StatCard label="Queries This Week"     value={overview?.queries_this_week ?? 0} />
            <StatCard label="Active Users Today"    value={overview?.active_users_today ?? 0} />
            <StatCard label="Total Conversations"   value={overview?.total_conversations ?? 0} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Active Users (7d)"
              value={overview?.active_users_this_week ?? 0}
            />
            <StatCard
              label="Documents Indexed"
              value={overview?.documents_indexed ?? 0}
            />
            <StatCard
              label="No-Answer Rate"
              value={`${((overview?.no_answer_rate ?? 0) * 100).toFixed(1)}%`}
              sub="low is better"
            />
            <StatCard
              label="Avg Response Time"
              value={overview?.avg_response_time_ms ? `${overview.avg_response_time_ms} ms` : '—'}
              sub="see chart below"
            />
          </div>

          {/* ── Charts grid ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* 1. Daily Active Users */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                Daily Active Users (last {days} days)
              </h2>
              {dau.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dau} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={xInterval} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#1e3a5f"
                      strokeWidth={2}
                      fill="url(#dauGrad)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No active users in this period" />
              )}
            </div>

            {/* 2. Queries by Department (Pie) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries by Department</h2>
              {deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={deptData}
                      dataKey="count"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                    >
                      {deptData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No department data yet" />
              )}
            </div>

            {/* 3. Queries per hour (last 24 h) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries per Hour (last 24 h)</h2>
              {hourly.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={hourly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No queries in the last 24 hours" />
              )}
            </div>

            {/* 4. Avg Response Time */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">Avg Response Time ms (last 24 h)</h2>
              {rtData.some((d) => d.avg_ms != null) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={rtData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
                      formatter={(v: unknown) => [`${v} ms`, 'Avg response']}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_ms"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No response time data yet" />
              )}
            </div>

            {/* 5. Top cited documents (horizontal bar) — full width */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                Top Cited Documents (last {days} days)
              </h2>
              {topDocs.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(180, topDocs.length * 32)}>
                  <BarChart
                    data={topDocs}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="filename"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={160}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
                      formatter={(v: unknown) => [`${v} citations`, 'Citations']}
                    />
                    <Bar dataKey="citation_count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No documents cited yet" />
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
