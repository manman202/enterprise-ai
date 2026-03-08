import { useEffect, useState } from 'react'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'
import { AuditLog, auditApi } from '@/api/admin'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function exportCsv(logs: AuditLog[]) {
  const header = ['Timestamp', 'User', 'Action', 'Resource', 'Outcome', 'IP Address']
  const rows = logs.map((l) => [
    l.created_at,
    l.username ?? l.user_id ?? '',
    l.action,
    l.resource,
    l.outcome,
    l.ip_address,
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `audit-logs-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [logs,     setLogs]     = useState<AuditLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [userFilter,    setUserFilter]    = useState('')
  const [actionFilter,  setActionFilter]  = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'allow' | 'deny'>('all')

  function fetchLogs() {
    setLoading(true)
    auditApi
      .list({
        user:    userFilter    || undefined,
        action:  actionFilter  || undefined,
        outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
        limit:   200,
      })
      .then(setLogs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLogs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault()
    fetchLogs()
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader
        title="Audit Logs"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportCsv(logs)}
            disabled={logs.length === 0}
          >
            <Download size={14} />
            Export CSV
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <form
        onSubmit={handleApplyFilters}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">User</label>
          <input
            type="text"
            placeholder="username…"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="h-9 w-40 rounded-lg border border-gray-200 px-3 text-sm text-gray-800
                       placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2
                       focus:ring-blue-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Action</label>
          <input
            type="text"
            placeholder="e.g. login…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 w-40 rounded-lg border border-gray-200 px-3 text-sm text-gray-800
                       placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2
                       focus:ring-blue-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Outcome</label>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as typeof outcomeFilter)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700
                       focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All</option>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
        </div>

        <Button type="submit" size="sm" variant="primary">
          Apply
        </Button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="w-6 px-4 py-3" />
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === log.id ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTs(log.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {log.username ?? log.user_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.action}</td>
                    <td className="px-4 py-3 text-gray-500">{log.resource}</td>
                    <td className="px-4 py-3">
                      <Badge variant={log.outcome === 'allow' ? 'ok' : 'error'}>
                        {log.outcome.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ip_address}</td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-expanded`}>
                      <td colSpan={7} className="bg-gray-50 px-8 py-4">
                        <p className="mb-1 text-xs font-medium text-gray-500">Details</p>
                        <pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-700">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
