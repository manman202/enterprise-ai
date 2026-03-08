import { useState } from 'react'
import { Info } from 'lucide-react'
import {
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

// ── Mock data generators ──────────────────────────────────────────────────────

function dailyUsers(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      users: Math.floor(10 + Math.random() * 40),
    }
  })
}

function avgResponseTime(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ms: Math.floor(800 + Math.random() * 1200),
    }
  })
}

const DEPT_PIE = [
  { name: 'Engineering', value: 142 },
  { name: 'HR',          value: 87  },
  { name: 'Finance',     value: 63  },
  { name: 'Legal',       value: 41  },
  { name: 'Operations',  value: 29  },
]

const PIE_COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

const TOP_TOPICS = [
  { topic: 'HR Policies',      count: 89 },
  { topic: 'Leave Requests',   count: 74 },
  { topic: 'Expense Reports',  count: 62 },
  { topic: 'IT Support',       count: 55 },
  { topic: 'Onboarding',       count: 48 },
  { topic: 'Compliance',       count: 41 },
  { topic: 'Benefits',         count: 37 },
  { topic: 'Payroll',          count: 33 },
  { topic: 'Security',         count: 28 },
  { topic: 'Training',         count: 21 },
]

type Range = '7' | '30' | '90'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30')
  const days = parseInt(range, 10)

  const dauData  = dailyUsers(days)
  const rtData   = avgResponseTime(days)

  // Thin out x-axis labels so they don't overlap
  const xInterval = days <= 7 ? 0 : days <= 30 ? 4 : 14

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Analytics" />

      {/* Notice banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          Analytics data will populate once the platform has active users. Charts below use
          placeholder data — real metrics will be available in Phase 9.
        </p>
      </div>

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
            {r} days
          </button>
        ))}
      </div>

      {/* Charts grid — 2 columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* 1. Daily Active Users */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Daily Active Users</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dauData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={xInterval} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#1e3a5f"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Queries by Department (Pie) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Queries by Department</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={DEPT_PIE}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
              >
                {DEPT_PIE.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Top Topics (horizontal BarChart) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Top Topics</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={TOP_TOPICS}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis
                type="category"
                dataKey="topic"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                width={95}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Avg Response Time */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Avg Response Time (ms)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rtData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={xInterval} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <Line
                type="monotone"
                dataKey="ms"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
