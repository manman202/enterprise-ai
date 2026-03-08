import { useEffect, useState } from 'react'
import { Users, MessageSquare, FileText, Activity } from 'lucide-react'
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
import { adminApi, knowledgeApi, healthApi, Document } from '@/api/admin'
import { PageHeader } from '@/components/layout/PageHeader'

// ── Mock chart data ───────────────────────────────────────────────────────────

const HOURLY_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  queries: Math.floor(Math.random() * 50),
}))

const DEPT_DATA = [
  { dept: 'Engineering', queries: 142 },
  { dept: 'HR',          queries: 87  },
  { dept: 'Finance',     queries: 63  },
  { dept: 'Legal',       queries: 41  },
  { dept: 'Operations',  queries: 29  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthResponse = {
  status: string
  services: Record<string, { status: string; latency_ms?: number }>
}

const SERVICE_CARDS = [
  { key: 'postgres',  label: 'PostgreSQL'  },
  { key: 'chromadb',  label: 'ChromaDB'    },
  { key: 'ollama',    label: 'Ollama'      },
  { key: 'backend',   label: 'Backend API' },
  { key: 'frontend',  label: 'Frontend'    },
  { key: 'admin',     label: 'Admin UI'    },
]

function statusDotClass(status: string | undefined): string {
  if (status === 'ok' || status === 'healthy') return 'bg-green-500'
  if (status === 'degraded')                   return 'bg-yellow-400'
  if (status === 'unknown')                    return 'bg-gray-400'
  return 'bg-red-500'
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
  const [users,  setUsers]  = useState<AdminUser[] | null>(null)
  const [docs,   setDocs]   = useState<Document[]  | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)

  function fetchAll() {
    adminApi.listUsers().then(setUsers).catch(() => setUsers(null))
    knowledgeApi.listDocuments().then(setDocs).catch(() => setDocs(null))
    healthApi.check().then(setHealth).catch(() => setHealth(null))
  }

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [])

  const overallOk = health?.status === 'ok' || health?.status === 'healthy'

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
          value="—"
          subtitle="analytics in Phase 9"
        />
        <KpiCard
          icon={<FileText size={20} />}
          label="Documents Indexed"
          value={docs != null ? docs.length : '—'}
          subtitle="in knowledge base"
        />
        <KpiCard
          icon={<Activity size={20} />}
          label="System Health"
          value={
            health ? (
              <span className={overallOk ? 'text-green-600' : 'text-red-500'}>
                {overallOk ? 'Healthy' : 'Degraded'}
              </span>
            ) : (
              '—'
            )
          }
          subtitle={
            health
              ? `${Object.keys(health.services).length} services monitored`
              : 'checking…'
          }
        />
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries (last 24 h)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={HOURLY_DATA} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                interval={3}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="queries"
                stroke="#1e3a5f"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries by Department</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DEPT_DATA} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dept" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="queries" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 — Service Health Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Service Health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {SERVICE_CARDS.map(({ key, label }) => {
            const svc    = health?.services[key]
            const status = svc?.status ?? 'unknown'
            const latency = svc?.latency_ms

            return (
              <div
                key={key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(status)}`}
                  />
                  <span className="truncate text-xs font-medium text-gray-700">{label}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {latency !== undefined ? `${latency} ms` : status}
                </p>
                <p className="text-xs text-gray-400">uptime —</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
