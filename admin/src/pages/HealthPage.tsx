import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, RefreshCw, Server } from 'lucide-react'
import { healthApi } from '@/api/admin'
import { PageHeader } from '@/components/layout/PageHeader'

type HealthResponse = {
  status: string
  services: Record<string, { status: string; latency_ms?: number }>
}

const SYSTEM_INFO = [
  { label: 'Server OS',    value: 'Ubuntu 24.04' },
  { label: 'VPS IP',       value: '46.62.212.115' },
  { label: 'Stack',        value: 'FastAPI + PostgreSQL + ChromaDB + Ollama' },
  { label: 'Admin Panel',  value: 'React 18 + Vite + Tailwind CSS' },
]

function statusDot(status: string | undefined): string {
  if (status === 'ok' || status === 'healthy') return 'bg-green-500'
  if (status === 'degraded')                   return 'bg-yellow-400'
  return 'bg-red-500'
}

function statusLabel(status: string | undefined): string {
  if (status === 'ok' || status === 'healthy') return 'Healthy'
  if (status === 'degraded')                   return 'Degraded'
  return status ?? 'Unknown'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function HealthPage() {
  const [health,       setHealth]       = useState<HealthResponse | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [lastChecked,  setLastChecked]  = useState<Date | null>(null)

  function fetchHealth() {
    healthApi
      .check()
      .then((h) => {
        setHealth(h)
        setLastChecked(new Date())
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 10_000)
    return () => clearInterval(id)
  }, [])

  const overallOk = health?.status === 'ok' || health?.status === 'healthy'

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="System Health"
        actions={
          <button
            onClick={fetchHealth}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        }
      />

      {lastChecked && (
        <p className="text-xs text-gray-400">
          Last checked: {lastChecked.toLocaleTimeString()} · auto-refreshes every 10 s
        </p>
      )}

      {/* Overall status banner */}
      {health && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
            overallOk
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {overallOk ? (
            <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          ) : (
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
          )}
          <p className="font-medium">
            {overallOk ? 'All Systems Operational' : 'Degraded Performance'}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Service cards */}
      {health && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Services</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(health.services).map(([key, svc]) => (
              <div
                key={key}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${statusDot(svc.status)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{capitalize(key)}</p>
                  <p className="text-xs text-gray-400">
                    {statusLabel(svc.status)}
                    {svc.latency_ms !== undefined && ` · ${svc.latency_ms} ms`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!health && !error && (
        <p className="text-sm text-gray-400">Checking services…</p>
      )}

      {/* System info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Server size={16} className="text-[#1e3a5f]" />
          <h2 className="text-sm font-semibold text-gray-700">System Information</h2>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SYSTEM_INFO.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
