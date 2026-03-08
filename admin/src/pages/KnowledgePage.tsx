import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Trash2, Info } from 'lucide-react'
import { Document, knowledgeApi } from '@/api/admin'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function statusVariant(status: Document['status']): 'ok' | 'error' | 'warning' | 'neutral' {
  if (status === 'ingested') return 'ok'
  if (status === 'failed')   return 'error'
  return 'warning'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [docs,     setDocs]     = useState<Document[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reindexing, setReindexing] = useState(false)
  const [reindexMsg, setReindexMsg] = useState<string | null>(null)

  // Filters
  const [deptFilter,   setDeptFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Document['status']>('all')

  function load() {
    setLoading(true)
    knowledgeApi
      .listDocuments()
      .then(setDocs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const departments = useMemo(() => {
    const set = new Set(docs.map((d) => d.department).filter(Boolean))
    return Array.from(set).sort()
  }, [docs])

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (deptFilter !== 'all' && d.department !== deptFilter) return false
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      return true
    })
  }, [docs, deptFilter, statusFilter])

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return
    setDeleting(doc.id)
    try {
      await knowledgeApi.deleteDocument(doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  async function handleReindex() {
    if (!window.confirm('Re-index all documents? This may take a while.')) return
    setReindexing(true)
    setReindexMsg(null)
    try {
      await knowledgeApi.reindex()
      setReindexMsg('Re-index triggered successfully.')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-index failed')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Knowledge Base"
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={reindexing}
            onClick={handleReindex}
          >
            <RefreshCw size={14} />
            Re-index All
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {reindexMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {reindexMsg}
        </div>
      )}

      {/* ── Section 1: Documents ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Ingested Documents</h2>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="ml-auto h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm
                       text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2
                       focus:ring-blue-100"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700
                       focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All statuses</option>
            <option value="ingested">Ingested</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Filename</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">File Size</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ingested At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                    No documents found.
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {doc.filename}
                      {doc.error_message && (
                        <p className="mt-0.5 text-xs text-red-500 truncate">{doc.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.department || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatBytes(doc.file_size)}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.chunks_count}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(doc.status)}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {formatDate(doc.ingested_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deleting === doc.id}
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 size={13} />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Watched Paths ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-[#1e3a5f]">
            <Info size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">File Watching</h3>
            <p className="mt-1 text-sm text-gray-500">
              File watching is configured via the{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                WATCHED_PATHS
              </code>{' '}
              environment variable on the backend server. Files placed in watched directories are
              automatically ingested into the knowledge base.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
