/**
 * Knowledge Sources Manager — full CRUD for connector-based data sources.
 * Supports: SharePoint, SMB, Exchange, Local Folder, S3-compatible storage.
 * Features: Add/edit multi-step modal, test connection, manual sync, sync history.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, RefreshCw, Edit2, Trash2, Power, PowerOff, ChevronDown, ChevronRight,
  HardDrive, Server, Mail, FolderOpen, Cloud, Info, LucideIcon,
} from 'lucide-react'
import {
  KnowledgeSource, KnowledgeSourceCreate, SyncHistoryEntry, SourceType,
  knowledgeSourcesApi,
} from '@/api/knowledge_sources'
import { knowledgeApi, Document } from '@/api/admin'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPARTMENTS = ['Engineering', 'HR', 'Finance', 'Legal', 'Operations', 'IT', 'Management', 'General']

const SOURCE_TYPE_META: Record<SourceType, { label: string; Icon: LucideIcon }> = {
  sharepoint: { label: 'SharePoint',      Icon: Cloud       },
  smb:        { label: 'SMB File Server', Icon: Server      },
  exchange:   { label: 'Exchange Email',  Icon: Mail        },
  local:      { label: 'Local Folder',    Icon: FolderOpen  },
  s3:         { label: 'S3 Storage',      Icon: HardDrive   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function statusBadgeVariant(status: KnowledgeSource['status']): 'ok' | 'error' | 'warning' | 'neutral' {
  if (status === 'active')   return 'ok'
  if (status === 'error')    return 'error'
  if (status === 'syncing')  return 'warning'
  return 'neutral'
}

function truncate(s: string | null | undefined, n = 40): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Source Config Form ────────────────────────────────────────────────────────

interface ConfigFormProps {
  sourceType: SourceType
  config: Record<string, string>
  onChange: (key: string, value: string) => void
}

function ConfigForm({ sourceType, config, onChange }: ConfigFormProps) {
  const field = (key: string, label: string, placeholder = '', type = 'text', hint?: string) => (
    <div key={key}>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={config[key] ?? ''}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                   focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )

  switch (sourceType) {
    case 'sharepoint':
      return (
        <div className="space-y-3">
          {field('tenant_id',     'Tenant ID',     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('client_id',     'Client ID',     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('client_secret', 'Client Secret', 'your-client-secret', 'password')}
          {field('site_url',      'Site URL',      'https://company.sharepoint.com/sites/HR')}
          {field('folder_path',   'Folder Path',   '/Shared Documents/HR')}
          {field('drive_id',      'Drive ID (optional)', '', 'text', 'Leave blank to use the default document library')}
        </div>
      )
    case 'smb':
      return (
        <div className="space-y-3">
          {field('server',   'Server',           '192.168.1.100 or \\\\fileserver')}
          {field('share',    'Share Name',        'HR_Documents')}
          {field('username', 'Username',          'domain\\user')}
          {field('password', 'Password',          '', 'password')}
          {field('domain',   'Domain (optional)', 'COMPANY')}
          {field('path',     'Path within share', '/Archives/2024')}
        </div>
      )
    case 'exchange':
      return (
        <div className="space-y-3">
          {field('server',      'Server',       'mail.company.com')}
          {field('username',    'Username',     'user@company.com')}
          {field('password',    'Password',     '', 'password')}
          {field('folder_path', 'Folder Path',  'Inbox/HR Archive')}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Protocol</label>
            <select
              value={config['protocol'] ?? 'ews'}
              onChange={(e) => onChange('protocol', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                         focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="ews">EWS (Exchange Web Services)</option>
              <option value="imap">IMAP</option>
            </select>
          </div>
        </div>
      )
    case 'local':
      return (
        <div className="space-y-3">
          {field('path', 'Absolute Path on VPS', '/mnt/shares/HR',
            'text', 'Make sure this folder is mounted on the VPS and readable by the backend container.')}
        </div>
      )
    case 's3':
      return (
        <div className="space-y-3">
          {field('bucket',            'Bucket Name',             'my-bucket')}
          {field('prefix',            'Prefix / Folder',         'documents/hr/')}
          {field('region',            'Region',                  'us-east-1')}
          {field('access_key_id',     'Access Key ID',           'AKIAIOSFODNN7EXAMPLE')}
          {field('secret_access_key', 'Secret Access Key',       '', 'password')}
          {field('endpoint_url',      'Endpoint URL (optional)', 'https://s3.company.com',
            'text', 'Leave blank for AWS S3. Set for MinIO, Cloudflare R2, etc.')}
        </div>
      )
  }
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────

interface ModalProps {
  editing: KnowledgeSource | null
  onClose: () => void
  onSaved: (source: KnowledgeSource) => void
}

function SourceModal({ editing, onClose, onSaved }: ModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(editing ? 2 : 1)
  const [sourceType, setSourceType] = useState<SourceType>(editing?.source_type ?? 'local')
  const [name, setName] = useState(editing?.name ?? '')
  const [department, setDepartment] = useState(editing?.department ?? '')
  const [config, setConfig] = useState<Record<string, string>>(() => {
    if (editing?.config) return Object.fromEntries(Object.entries(editing.config).map(([k, v]) => [k, String(v)]))
    return {}
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; files_found?: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleConfigChange(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)  // reset test when config changes
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const result = await knowledgeSourcesApi.testConnection(sourceType, config as Record<string, unknown>)
      setTestResult(result)
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      let saved: KnowledgeSource
      if (editing) {
        saved = await knowledgeSourcesApi.update(editing.id, {
          name, department: department || undefined, config: config as Record<string, unknown>,
        })
      } else {
        const body: KnowledgeSourceCreate = {
          name, department: department || undefined, source_type: sourceType,
          config: config as Record<string, unknown>, is_active: true,
        }
        saved = await knowledgeSourcesApi.create(body)
      }
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit Source' : 'Add Knowledge Source'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        {/* Step indicators (only for new) */}
        {!editing && (
          <div className="flex items-center gap-0 border-b border-gray-100 px-6 py-3">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                  ${step >= s ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {s}
                </div>
                <span className={`ml-1.5 text-xs ${step >= s ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {s === 1 ? 'Choose Type' : s === 2 ? 'Configure' : 'Test & Save'}
                </span>
                {s < 3 && <div className="mx-3 h-px w-6 bg-gray-200" />}
              </div>
            ))}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {/* Step 1 — Choose type */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.entries(SOURCE_TYPE_META) as [SourceType, typeof SOURCE_TYPE_META[SourceType]][]).map(
                ([type, { label, Icon }]) => (
                  <button
                    key={type}
                    onClick={() => { setSourceType(type); setStep(2) }}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors
                      ${sourceType === type
                        ? 'border-[#1e3a5f] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <Icon size={20} className="shrink-0 text-[#1e3a5f]" />
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                  </button>
                )
              )}
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Source Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HR SharePoint"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                             focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                             focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Select department —</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {SOURCE_TYPE_META[sourceType].label} Settings
                </p>
                <ConfigForm
                  sourceType={sourceType}
                  config={config}
                  onChange={handleConfigChange}
                />
              </div>
            </div>
          )}

          {/* Step 3 — Test & Save */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-700">{name}</p>
                <p className="text-xs text-gray-400">{SOURCE_TYPE_META[sourceType].label} · {department || 'No department'}</p>
              </div>

              <div>
                <Button
                  variant="secondary"
                  loading={testing}
                  onClick={handleTest}
                  className="w-full"
                >
                  Test Connection
                </Button>

                {testResult && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm
                    ${testResult.success ? 'border border-green-200 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-700'}`}>
                    <span className="mt-0.5 text-base">{testResult.success ? '✓' : '✗'}</span>
                    <span>
                      {testResult.message}
                      {testResult.files_found != null && ` — ${testResult.files_found} files found`}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <div>
            {step > 1 && !editing && (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            {step === 1 && (
              <Button size="sm" onClick={() => setStep(2)}>Next →</Button>
            )}
            {step === 2 && (
              <Button size="sm" onClick={() => setStep(3)} disabled={!name.trim()}>
                Next →
              </Button>
            )}
            {(step === 3 || editing) && (
              <Button
                size="sm"
                loading={saving}
                disabled={!editing && !testResult?.success}
                onClick={handleSave}
              >
                {editing ? 'Save Changes' : 'Save Source'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sync History Panel ────────────────────────────────────────────────────────

function SyncHistoryPanel({ sourceId }: { sourceId: string }) {
  const [history, setHistory] = useState<SyncHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    knowledgeSourcesApi.syncHistory(sourceId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <div className="py-4 text-center text-sm text-gray-400"><Spinner size="sm" /></div>
  if (history.length === 0) return <p className="py-4 text-center text-sm text-gray-400">No sync history yet.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left font-medium uppercase tracking-wide text-gray-400">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Files</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {history.map((entry) => (
            <tr key={entry.id}>
              <td className="py-2 pr-4 text-gray-500">{formatDate(entry.started_at)}</td>
              <td className="py-2 pr-4 text-gray-700">{entry.files_processed ?? '—'}</td>
              <td className="py-2 pr-4">
                <Badge variant={entry.status === 'success' ? 'ok' : 'error'}>
                  {entry.status}
                </Badge>
              </td>
              <td className="py-2 text-red-500 max-w-xs truncate">{entry.error ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [sources,    setSources]    = useState<KnowledgeSource[]>([])
  const [docs,       setDocs]       = useState<Document[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [modal,      setModal]      = useState<'add' | 'edit' | null>(null)
  const [editing,    setEditing]    = useState<KnowledgeSource | null>(null)
  const [syncing,    setSyncing]    = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)  // expanded row for sync history

  function load() {
    setLoading(true)
    Promise.all([
      knowledgeSourcesApi.list(),
      knowledgeApi.listDocuments(),
    ])
      .then(([srcs, d]) => { setSources(srcs); setDocs(d) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Compute stats
  const activeSources = useMemo(() => sources.filter((s) => s.is_active).length, [sources])
  const lastSync = useMemo(() => {
    const dates = sources.map((s) => s.last_sync_at).filter(Boolean) as string[]
    if (!dates.length) return null
    return dates.sort().reverse()[0]
  }, [sources])
  const errorSources = useMemo(() => sources.filter((s) => s.status === 'error'), [sources])

  // Sync handler
  async function handleSync(source: KnowledgeSource) {
    setSyncing(source.id)
    setError(null)
    try {
      await knowledgeSourcesApi.sync(source.id)
      // Optimistically set status to syncing
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, status: 'syncing' } : s))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  // Toggle active
  async function handleToggle(source: KnowledgeSource) {
    try {
      const updated = await knowledgeSourcesApi.update(source.id, { is_active: !source.is_active })
      setSources((prev) => prev.map((s) => s.id === source.id ? updated : s))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  // Delete
  async function handleDelete(source: KnowledgeSource) {
    if (!window.confirm(`Delete "${source.name}"? This cannot be undone.`)) return
    setDeleting(source.id)
    try {
      await knowledgeSourcesApi.delete(source.id)
      setSources((prev) => prev.filter((s) => s.id !== source.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  // Modal saved callback
  function handleSaved(source: KnowledgeSource) {
    if (editing) {
      setSources((prev) => prev.map((s) => s.id === source.id ? source : s))
    } else {
      setSources((prev) => [source, ...prev])
    }
    setModal(null)
    setEditing(null)
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Knowledge Sources"
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setModal('add') }}>
            <Plus size={14} />
            Add Source
          </Button>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-400">Total Sources</p>
          <p className="text-2xl font-bold text-gray-900">{sources.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-400">Active Sources</p>
          <p className="text-2xl font-bold text-green-600">{activeSources}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-400">Last Sync</p>
          <p className="text-sm font-semibold text-gray-700 mt-1">{formatDate(lastSync)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-400">Documents Indexed</p>
          <p className="text-2xl font-bold text-gray-900">{docs.length}</p>
        </div>
      </div>

      {/* Sources table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 w-6" />
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Path / URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-gray-400">
                    <Spinner size="sm" />
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Info size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">No knowledge sources configured yet.</p>
                      <Button size="sm" onClick={() => setModal('add')}>
                        <Plus size={13} /> Add your first source
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                sources.map((source) => {
                  const { Icon, label } = SOURCE_TYPE_META[source.source_type] ?? { Icon: Server, label: source.source_type }
                  const isExpanded = expanded === source.id
                  const pathValue = (source.config as Record<string, string> | null)?.[
                    source.source_type === 'sharepoint' ? 'site_url' :
                    source.source_type === 'smb' ? 'server' :
                    source.source_type === 'exchange' ? 'server' :
                    source.source_type === 'local' ? 'path' :
                    'bucket'
                  ] ?? '—'

                  return [
                    <tr
                      key={source.id}
                      className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setExpanded(isExpanded ? null : source.id)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{source.name}</td>
                      <td className="px-4 py-3 text-gray-500">{source.department ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Icon size={13} />
                          <span className="text-xs">{label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono max-w-[160px] truncate">
                        {truncate(pathValue, 30)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(source.status)}>
                            {source.status === 'syncing' ? (
                              <span className="flex items-center gap-1">
                                <Spinner size="sm" />Syncing
                              </span>
                            ) : source.status}
                          </Badge>
                          {source.status === 'error' && source.last_error && (
                            <span className="cursor-help text-xs text-red-400" title={source.last_error}>⚠</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(source.last_sync_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {source.last_sync_count ?? '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Sync now */}
                          <button
                            disabled={syncing === source.id || source.status === 'syncing'}
                            onClick={() => handleSync(source)}
                            title="Sync now"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#1e3a5f]
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RefreshCw size={14} className={syncing === source.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => { setEditing(source); setModal('edit') }}
                            title="Edit"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#1e3a5f]"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Toggle active */}
                          <button
                            onClick={() => handleToggle(source)}
                            title={source.is_active ? 'Deactivate' : 'Activate'}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#1e3a5f]"
                          >
                            {source.is_active ? <Power size={14} className="text-green-500" /> : <PowerOff size={14} />}
                          </button>

                          {/* Delete */}
                          <button
                            disabled={deleting === source.id}
                            onClick={() => handleDelete(source)}
                            title="Delete"
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deleting === source.id ? <Spinner size="sm" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>,

                    // Expanded sync history row
                    isExpanded && (
                      <tr key={`${source.id}-history`} className="border-t border-gray-100 bg-blue-50/30">
                        <td />
                        <td colSpan={8} className="px-6 py-4">
                          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Sync History — last 10 runs
                          </h4>
                          <SyncHistoryPanel sourceId={source.id} />
                        </td>
                      </tr>
                    ),
                  ]
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File watching info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-[#1e3a5f]">
            <Info size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Sync Schedule</h3>
            <p className="mt-1 text-sm text-gray-500">
              Active sources are synced automatically every <strong>15 minutes</strong>.
              You can also trigger a manual sync using the{' '}
              <RefreshCw size={12} className="inline" /> button.
              Configure additional watched paths via the{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                WATCHED_PATHS
              </code>{' '}
              environment variable on the backend for real-time file ingestion.
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <SourceModal
          editing={modal === 'edit' ? editing : null}
          onClose={() => { setModal(null); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Error sources warning banner */}
      {errorSources.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>{errorSources.length} source{errorSources.length > 1 ? 's' : ''} failed last sync:</strong>{' '}
          {errorSources.map((s) => s.name).join(', ')}.
          Check the sync history for details.
        </div>
      )}
    </div>
  )
}
