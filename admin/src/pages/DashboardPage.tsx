import { useEffect, useRef, useState } from 'react'
import { Users, MessageSquare, FileText, Activity, RefreshCw } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AdminUser } from '@/api/auth'
import { adminApi, knowledgeApi, healthApi, Document, DetailedHealthResponse, ServiceDetail } from '@/api/admin'
import { analyticsApi, AnalyticsOverview, HourlyQueryPoint, DeptQueryPoint } from '@/api/analytics'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30  // seconds

const SERVICE_CARDS: { key: keyof DetailedHealthResponse['services']; label: string }[] = [
  { key: 'postgres',  label: 'PostgreSQL'  },
  { key: 'chromadb',  label: 'ChromaDB'    },
  { key: 'ollama',    label: 'Ollama'      },
  { key: 'backend',   label: 'Backend API' },
  { key: 'frontend',  label: 'Frontend'    },
  { key: 'admin',     label: 'Admin UI'    },
  { key: 'gitlab',    label: 'GitLab'      },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusDotClass(status: string | undefined, pulsing = false): string {
  const base = 'h-2.5 w-2.5 shrink-0 rounded-full'
  let color = 'bg-gray-400'
  if (status === 'healthy') color = 'bg-green-500'
  else if (status === 'unhealthy') color = 'bg-red-500'
  else if (status === 'unknown') color = 'bg-gray-400'
  return `${base} ${color}${pulsing ? ' animate-pulse' : ''}`
}

function ProgressBar({
  value,
  danger = false,
  warning = false,
}: {
  value: number
  danger?: boolean
  warning?: boolean
}) {
  const color = danger ? 'bg-red-500' : warning ? 'bg-yellow-400' : 'bg-blue-500'
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subtitle?: string
}

function KpiCard({ icon, label, value, subtitle }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-blue-50 p-2 text-[#1e3a5f]">{icon}</div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [users,        setUsers]        = useState<AdminUser[] | null>(null)
  const [docs,         setDocs]         = useState<Document[]  | null>(null)
  const [health,       setHealth]       = useState<DetailedHealthResponse | null>(null)
  const [overview,     setOverview]     = useState<AnalyticsOverview | null>(null)
  const [hourlyData,   setHourlyData]   = useState<HourlyQueryPoint[]>([])
  const [deptData,     setDeptData]     = useState<DeptQueryPoint[]>([])
  const [refreshing,   setRefreshing]   = useState(false)
  const [countdown,    setCountdown]    = useState(REFRESH_INTERVAL)
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null)

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchHealth() {
    setRefreshing(true)
    try {
      const data = await healthApi.detailed()
      setHealth(data)
      setLastUpdated(new Date())
    } catch {
      // health stays as last known value
    } finally {
      setRefreshing(false)
      setCountdown(REFRESH_INTERVAL)
    }
  }

  function fetchAll() {
    adminApi.listUsers().then(setUsers).catch(() => setUsers(null))
    knowledgeApi.listDocuments().then(setDocs).catch(() => setDocs(null))
    analyticsApi.overview().then(setOverview).catch(() => setOverview(null))
    analyticsApi.queriesPerHour().then(setHourlyData).catch(() => setHourlyData([]))
    analyticsApi.queriesPerDepartment(7).then(setDeptData).catch(() => setDeptData([]))
    fetchHealth()
  }

  useEffect(() => {
    fetchAll()

    // Auto-refresh health every 30 seconds
    intervalRef.current = setInterval(fetchHealth, REFRESH_INTERVAL * 1000)

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1))
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute overall status
  const services = health?.services
  const allHealthy = services
    ? Object.values(services).every((s) => (s as ServiceDetail).status === 'healthy')
    : null
  const sys = health?.system

  return (
    <div className="max-w-7xl space-y-8">
      <PageHeader title="Dashboard" />

      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Users size={20} />}
          label="Total Users"
          value={users != null ? users.length : '—'}
          subtitle="registered accounts"
        />
        <KpiCard
          icon={<MessageSquare size={20} />}
          label="Queries Today"
          value={overview != null ? overview.queries_today : '—'}
          subtitle={overview != null ? `${overview.active_users_today} active users` : 'loading…'}
        />
        <KpiCard
          icon={<FileText size={20} />}
          label="Documents Indexed"
          value={overview != null ? overview.documents_indexed : (docs != null ? docs.length : '—')}
          subtitle="in knowledge base"
        />
        <KpiCard
          icon={<Activity size={20} />}
          label="System Health"
          value={
            allHealthy !== null ? (
              <span className={allHealthy ? 'text-green-600' : 'text-red-500'}>
                {allHealthy ? 'Healthy' : 'Degraded'}
              </span>
            ) : '—'
          }
          subtitle={
            services
              ? `${Object.keys(services).length} services monitored`
              : 'checking…'
          }
        />
      </div>

      {/* Row 2 — Charts (real data) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries (last 24 h)</h2>
          {hourlyData.length > 0 && hourlyData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hourlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="count" stroke="#1e3a5f" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
              No queries in the last 24 hours
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries by Department (last 7 days)</h2>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
              No department data yet
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Service Health Grid */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Service Health</h2>
          <span className="text-xs text-gray-400">
            {refreshing ? 'Refreshing…' : `Refreshing in ${countdown}s`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={fetchHealth}
            className="ml-auto"
          >
            <RefreshCw size={13} />
            Refresh now
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {SERVICE_CARDS.map(({ key, label }) => {
            const svc = services?.[key] as ServiceDetail | undefined
            const status = svc?.status ?? 'unknown'
            const ms = svc?.response_ms

            return (
              <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className={statusDotClass(status, refreshing)} />
                  <span className="truncate text-xs font-medium text-gray-700">{label}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {ms !== undefined ? `${ms} ms` : status}
                </p>
                {key === 'ollama' && (svc as ServiceDetail & { model_loaded?: string })?.model_loaded && (
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {(svc as ServiceDetail & { model_loaded?: string }).model_loaded}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {lastUpdated && (
          <p className="mt-2 text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Row 4 — System Metrics */}
      {sys && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">System Resources</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* CPU */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">CPU Usage</p>
              <p className="mb-2 text-xl font-bold text-gray-900">{sys.cpu_percent}%</p>
              <ProgressBar value={sys.cpu_percent} danger={sys.cpu_percent > 85} warning={sys.cpu_percent > 70} />
            </div>

            {/* RAM */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">RAM</p>
              <p className="mb-2 text-xl font-bold text-gray-900">
                {sys.ram_used_gb} GB
                <span className="ml-1 text-sm font-normal text-gray-400">/ {sys.ram_total_gb} GB</span>
              </p>
              <ProgressBar value={sys.ram_percent} danger={sys.ram_percent > 85} warning={sys.ram_percent > 70} />
              <p className="mt-1 text-xs text-gray-400">{sys.ram_percent}% used</p>
            </div>

            {/* Disk */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">Disk</p>
              <p className="mb-2 text-xl font-bold text-gray-900">
                {sys.disk_used_gb} GB
                <span className="ml-1 text-sm font-normal text-gray-400">/ {sys.disk_total_gb} GB</span>
              </p>
              <ProgressBar value={sys.disk_percent} danger={sys.disk_percent > 80} warning={sys.disk_percent > 65} />
              <p className="mt-1 text-xs text-gray-400">{sys.disk_percent}% used</p>
            </div>

            {/* Swap */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-gray-500">Swap</p>
              <p className="mb-2 text-xl font-bold text-gray-900">
                {sys.swap_used_gb} GB
                <span className="ml-1 text-sm font-normal text-gray-400">/ {sys.swap_total_gb} GB</span>
              </p>
              <ProgressBar
                value={sys.swap_total_gb > 0 ? (sys.swap_used_gb / sys.swap_total_gb) * 100 : 0}
                warning={(sys.swap_used_gb / sys.swap_total_gb) > 0.5}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
