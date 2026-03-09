/**
 * FileDropZone — full drag & drop upload component for knowledge sources.
 *
 * Phases: select → uploading → done
 * Supports: drag & drop files, drag & drop folders (recursive via webkitGetAsEntry),
 *           Browse Files button, Browse Folder button.
 * Upload: batches of 5, per-file status, cancel, summary banner.
 */

import { useRef, useState } from 'react'
import {
  UploadCloud, FolderOpen, FileText, X, CheckCircle, AlertCircle,
  Loader2, RefreshCw, File as FileIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ── Constants & helpers ───────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md']

function isSupported(filename: string): boolean {
  const ext = '.' + (filename.split('.').pop() ?? '').toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(ext)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/** Map raw backend/network error strings to user-friendly messages. */
function humanizeError(err: string | null | undefined): string {
  if (!err) return ''
  if (err.includes('Unsupported file type') || err.includes('Unsupported extension')) {
    const m = err.match(/\.\w+/)
    return `Unsupported type${m ? ': ' + m[0] : ''}`
  }
  if (err.includes('ingestion failed') || err.includes('Saved but')) return 'File saved but could not be indexed'
  if (err.includes('50 MB') || err.includes('50MB') || err.includes('exceeds')) return 'Exceeds 50 MB limit'
  if (
    err.includes('fetch') ||
    err.includes('network') ||
    err.includes('Failed to fetch') ||
    err.includes('NetworkError')
  ) return 'Could not reach server — check your connection'
  if (err.includes('Local path') && err.includes('does not exist')) return 'Server path not found'
  // Truncate long messages
  return err.length > 60 ? err.slice(0, 57) + '…' : err
}

function fileExt(name: string): string {
  return ('.' + (name.split('.').pop() ?? '')).toLowerCase()
}

/**
 * Detect iCloud placeholder files that haven't been downloaded from iCloud Drive.
 * On macOS/iOS, un-downloaded iCloud files appear with a .icloud extension,
 * often start with a dot, or have size 0 because the content isn't local.
 */
function isICloudPlaceholder(file: File, relativePath = ''): boolean {
  const name = file.name.toLowerCase()
  // .icloud extension = evicted file placeholder (e.g. .report.pdf.icloud)
  if (name.endsWith('.icloud')) return true
  // Path contains iCloud Drive marker
  if (relativePath.toLowerCase().includes('icloud~') || relativePath.toLowerCase().includes('mobile documents')) return true
  // Zero-byte file that isn't a legitimately empty text/md document
  if (file.size === 0 && !['.txt', '.md'].includes(fileExt(file.name))) return true
  return false
}

function extColor(name: string): string {
  const e = fileExt(name)
  if (e === '.pdf') return 'text-red-500'
  if (e === '.docx' || e === '.doc') return 'text-blue-500'
  if (e === '.xlsx' || e === '.xls') return 'text-green-600'
  return 'text-gray-400'
}

/** Recursively walk a FileSystemDirectoryEntry. */
async function walkDirectory(
  dirEntry: FileSystemDirectoryEntry,
  onFile: (file: File, path: string) => void,
  currentPath = '',
): Promise<void> {
  const reader = dirEntry.createReader()

  const readAllEntries = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      const all: FileSystemEntry[] = []
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(all)
          } else {
            all.push(...entries)
            readBatch()
          }
        }, reject)
      }
      readBatch()
    })

  const entries = await readAllEntries()
  const folderPath = currentPath ? `${currentPath}/${dirEntry.name}` : dirEntry.name

  for (const entry of entries) {
    if (entry.isFile) {
      const fe = entry as FileSystemFileEntry
      await new Promise<void>((resolve) => {
        fe.file((file) => {
          if (isSupported(file.name)) onFile(file, `${folderPath}/${file.name}`)
          resolve()
        })
      })
    } else if (entry.isDirectory) {
      await walkDirectory(entry as FileSystemDirectoryEntry, onFile, folderPath)
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueuedFile {
  file: File
  relativePath: string   // '' for root files, 'Folder/sub/file.pdf' for folder drops
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  chunks?: number
  icloudWarning?: boolean  // file detected as un-downloaded iCloud placeholder
}

export interface UploadResult {
  filename: string
  size: number
  status: 'success' | 'rejected' | 'error'
  error: string | null
  chunks_created: number | null
}

type Phase = 'select' | 'uploading' | 'done'

// ── FileDropZone ──────────────────────────────────────────────────────────────

interface Props {
  sourceId: string
  sourceName?: string
  localPath?: string
  onDone: (results: UploadResult[]) => void
  onCancel?: () => void
  /** If true, don't render the outer card — embed inside a parent modal */
  embedded?: boolean
}

export default function FileDropZone({
  sourceId,
  sourceName,
  localPath,
  onDone,
  onCancel,
  embedded = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>('select')
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [cancelled, setCancelled] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)

  // Grouped by folder prefix for display
  const grouped = groupByFolder(queue)

  // iCloud placeholder detection
  const icloudFiles = queue.filter((q) => q.icloudWarning)
  const hasICloudFiles = icloudFiles.length > 0

  // ── File collection ────────────────────────────────────────────────────────

  function addFile(file: File, path = '') {
    const key = `${file.name}-${file.size}`
    setQueue((prev) => {
      if (prev.some((q) => `${q.file.name}-${q.file.size}` === key)) return prev
      const icloudWarning = isICloudPlaceholder(file, path)
      return [...prev, { file, relativePath: path || file.name, status: 'pending', icloudWarning }]
    })
  }

  function removeFile(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const items = Array.from(e.dataTransfer.items)

    for (const item of items) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()

      if (entry) {
        if (entry.isDirectory) {
          await walkDirectory(entry as FileSystemDirectoryEntry, (file, path) => addFile(file, path))
        } else if (entry.isFile) {
          const fe = entry as FileSystemFileEntry
          await new Promise<void>((resolve) => {
            fe.file((file) => { if (isSupported(file.name)) addFile(file); resolve() })
          })
        }
      } else {
        // Fallback: no FileSystem API
        const f = item.getAsFile()
        if (f && isSupported(f.name)) addFile(f)
      }
    }
  }

  // ── File input handlers ────────────────────────────────────────────────────

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).filter((f) => isSupported(f.name)).forEach((f) => addFile(f))
    e.target.value = ''
  }

  function onFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? [])
      .filter((f) => isSupported(f.name))
      .forEach((f) => {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
        addFile(f, rel)
      })
    e.target.value = ''
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (queue.length === 0) return
    cancelRef.current = false
    setCancelled(false)
    setPhase('uploading')
    setUploadedCount(0)

    const BATCH = 5
    const allResults: UploadResult[] = []
    let done = 0

    for (let i = 0; i < queue.length; i += BATCH) {
      if (cancelRef.current) break
      const batch = queue.slice(i, i + BATCH)

      // Mark batch as uploading
      setQueue((prev) =>
        prev.map((q, idx) =>
          idx >= i && idx < i + BATCH ? { ...q, status: 'uploading' } : q,
        ),
      )

      const formData = new FormData()
      for (const item of batch) formData.append('files', item.file, item.file.name)

      try {
        const token = localStorage.getItem('aiyedun_admin_token')
        const res = await fetch(`/api/v1/knowledge-sources/${sourceId}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const detail = (err as { detail?: string }).detail ?? `HTTP ${res.status}`
          for (const item of batch) {
            allResults.push({ filename: item.file.name, size: item.file.size, status: 'error', error: detail, chunks_created: null })
          }
          setQueue((prev) =>
            prev.map((q, idx) =>
              idx >= i && idx < i + BATCH ? { ...q, status: 'error', error: detail } : q,
            ),
          )
        } else {
          const data = await res.json() as { uploaded: UploadResult[] }
          allResults.push(...data.uploaded)
          setQueue((prev) =>
            prev.map((q, idx) => {
              if (idx < i || idx >= i + BATCH) return q
              const r = data.uploaded.find((u) => u.filename === q.file.name)
              return { ...q, status: r?.status === 'success' ? 'done' : 'error', chunks: r?.chunks_created ?? 0, error: humanizeError(r?.error) }
            }),
          )
        }
      } catch (e) {
        const msg = e instanceof Error
          ? (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed')
              ? 'Could not reach server — check your connection'
              : e.message)
          : 'Upload failed'
        for (const item of batch) {
          allResults.push({ filename: item.file.name, size: item.file.size, status: 'error', error: msg, chunks_created: null })
        }
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx >= i && idx < i + BATCH ? { ...q, status: 'error', error: msg } : q,
          ),
        )
      }

      done += batch.length
      setUploadedCount(done)
    }

    setResults(allResults)
    setPhase('done')
  }

  function handleCancel() {
    cancelRef.current = true
    setCancelled(true)
    setPhase('done')
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const okCount = results.filter((r) => r.status === 'success').length
  const errCount = results.filter((r) => r.status !== 'success').length
  const totalChunks = results.reduce((s, r) => s + (r.chunks_created ?? 0), 0)
  const totalSize = queue.reduce((s, q) => s + q.file.size, 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col gap-4">

      {/* Source path display */}
      {(sourceName || localPath) && phase !== 'uploading' && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <FolderOpen size={13} className="shrink-0 text-gray-400" />
          {sourceName && <span className="font-medium">{sourceName}</span>}
          {localPath && <code className="ml-1 font-mono text-gray-400">{localPath}</code>}
        </div>
      )}

      {/* ── SELECT phase ── */}
      {phase === 'select' && (
        <>
          {/* iCloud warning banner */}
          {hasICloudFiles && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-800">
                  iCloud files not downloaded
                </p>
                <p className="mt-0.5 text-amber-700">
                  {icloudFiles.length === 1
                    ? `"${icloudFiles[0].file.name}" is`
                    : `${icloudFiles.length} files are`}{' '}
                  stored in iCloud but not downloaded to this device. Open the file
                  in Finder first (right-click → Download Now), then re-add it.
                </p>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={[
              'relative rounded-xl border-2 border-dashed p-8 text-center',
              'transition-all duration-150 cursor-pointer select-none',
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-50/80',
            ].join(' ')}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud
              size={48}
              className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-blue-400' : 'text-gray-300'}`}
            />
            <p className={`text-sm font-semibold ${isDragging ? 'text-blue-600' : 'text-gray-600'}`}>
              {isDragging ? 'Release to add files' : 'Drop files or folders here'}
            </p>
            <p className="mt-1 text-xs text-gray-400">or</p>

            {/* Buttons — stop propagation so they don't trigger the div's click */}
            <div
              className="mt-3 flex items-center justify-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white
                           px-3 py-2 text-xs font-medium text-gray-600 shadow-sm
                           hover:bg-gray-50 hover:border-gray-300"
              >
                <FileText size={13} />
                Browse Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white
                           px-3 py-2 text-xs font-medium text-gray-600 shadow-sm
                           hover:bg-gray-50 hover:border-gray-300"
              >
                <FolderOpen size={13} />
                Browse Folder
              </button>
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              PDF, DOCX, XLSX, TXT, MD — max 50 MB per file
            </p>
          </div>

          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md"
            className="hidden"
            onChange={onFileInputChange}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error — non-standard but widely supported
            webkitdirectory=""
            mozdirectory=""
            multiple
            className="hidden"
            onChange={onFolderInputChange}
          />

          {/* File list */}
          {queue.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  {queue.length} file{queue.length !== 1 ? 's' : ''} selected
                  <span className="ml-1.5 font-normal text-gray-400">— {formatBytes(totalSize)}</span>
                </span>
                <button
                  onClick={() => setQueue([])}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                {grouped.map((group) => (
                  <div key={group.folder}>
                    {/* Folder group header */}
                    {group.folder && (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                        <FolderOpen size={11} />
                        {group.folder}
                        <span className="font-normal text-gray-400">({group.files.length} files)</span>
                      </div>
                    )}
                    {group.files.map(({ item, index }) => (
                      <div key={index} className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 ${item.icloudWarning ? 'bg-amber-50/60' : ''}`}>
                        {item.icloudWarning
                          ? <span title="File not downloaded from iCloud"><AlertCircle size={13} className="shrink-0 text-amber-400" /></span>
                          : <FileIcon size={13} className={`shrink-0 ${extColor(item.file.name)}`} />
                        }
                        <span
                          className={`flex-1 truncate ${item.icloudWarning ? 'text-amber-700' : 'text-gray-700'}`}
                          title={item.icloudWarning ? 'Not downloaded from iCloud — cannot upload' : item.relativePath}
                        >
                          {item.file.name.length > 35
                            ? item.file.name.slice(0, 34) + '…'
                            : item.file.name}
                        </span>
                        {group.folder && (
                          <span className="shrink-0 text-[10px] text-gray-400 max-w-[80px] truncate">
                            {folderOf(item.relativePath)}
                          </span>
                        )}
                        <span className="shrink-0 text-gray-400">{formatBytes(item.file.size)}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="shrink-0 text-gray-300 hover:text-red-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── UPLOADING phase ── */}
      {phase === 'uploading' && (
        <div className="space-y-3">
          {/* Overall progress */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
              <span>Uploading {uploadedCount} of {queue.length} files…</span>
              <button onClick={handleCancel} className="text-red-400 hover:text-red-600">Cancel</button>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.round((uploadedCount / queue.length) * 100)}%` }}
              />
            </div>
          </div>

          {/* Per-file status list */}
          <div className="max-h-[260px] overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
            {queue.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                {item.status === 'pending' && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                )}
                {item.status === 'uploading' && (
                  <Loader2 size={12} className="shrink-0 animate-spin text-blue-400" />
                )}
                {item.status === 'done' && (
                  <CheckCircle size={12} className="shrink-0 text-green-500" />
                )}
                {item.status === 'error' && (
                  <span title={item.error}>
                    <AlertCircle size={12} className="shrink-0 text-red-400" />
                  </span>
                )}
                <span className="flex-1 truncate text-gray-700">{item.file.name}</span>
                {item.status === 'done' && item.chunks != null && (
                  <span className="text-gray-400">{item.chunks} chunks</span>
                )}
                {item.status === 'error' && (
                  <span
                    className="max-w-[120px] truncate text-red-400 cursor-help"
                    title={item.error}
                  >
                    {item.error}
                  </span>
                )}
                <span className="shrink-0 text-gray-300">{formatBytes(item.file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DONE phase ── */}
      {phase === 'done' && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className={[
            'flex items-start gap-3 rounded-xl border px-4 py-3',
            errCount === 0 && !cancelled
              ? 'border-green-200 bg-green-50'
              : 'border-yellow-200 bg-yellow-50',
          ].join(' ')}>
            {errCount === 0 && !cancelled ? (
              <CheckCircle size={18} className="mt-0.5 shrink-0 text-green-500" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-500" />
            )}
            <div>
              {cancelled ? (
                <p className="text-sm font-medium text-yellow-800">Upload cancelled</p>
              ) : errCount === 0 ? (
                <p className="text-sm font-medium text-green-800">
                  ✓ {okCount} file{okCount !== 1 ? 's' : ''} ingested — {totalChunks} chunks created
                </p>
              ) : (
                <p className="text-sm font-medium text-yellow-800">
                  ⚠ {okCount} succeeded, {errCount} failed
                </p>
              )}
              {localPath && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Saved to <code className="font-mono">{localPath}</code>
                </p>
              )}
            </div>
          </div>

          {/* Results table */}
          {results.length > 0 && (
            <div className="max-h-[220px] overflow-y-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Chunks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td
                        className="max-w-[180px] truncate px-3 py-2 font-medium text-gray-700"
                        title={r.filename}
                      >
                        {r.filename}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{formatBytes(r.size)}</td>
                      <td className="px-3 py-2">
                        <span className={[
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          r.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'rejected'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700',
                        ].join(' ')}>
                          {r.status === 'success' ? (
                            <><CheckCircle size={9} /> Ingested</>
                          ) : r.status === 'rejected' ? (
                            'Rejected'
                          ) : (
                            <><AlertCircle size={9} /> Error</>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {r.status === 'success'
                          ? (r.chunks_created != null ? r.chunks_created : '—')
                          : (
                            <span className="text-red-500 text-[10px]" title={r.error ?? ''}>
                              {humanizeError(r.error)}
                            </span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Footer buttons
  const footer = (
    <div className="flex items-center justify-between pt-2">
      {phase === 'done' ? (
        <>
          <button
            onClick={() => { setPhase('select'); setQueue([]); setResults([]); setCancelled(false) }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={12} /> Upload more
          </button>
          <Button size="sm" onClick={() => onDone(results)}>Done</Button>
        </>
      ) : (
        <>
          {onCancel && (
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={phase === 'uploading'}>
              Cancel
            </Button>
          )}
          {phase === 'select' && (
            <Button
              size="sm"
              disabled={queue.length === 0}
              onClick={handleUpload}
              className="ml-auto"
            >
              <UploadCloud size={13} />
              Upload {queue.length > 0 ? `${queue.length} file${queue.length !== 1 ? 's' : ''}` : ''}
            </Button>
          )}
          {phase === 'uploading' && (
            <Button size="sm" loading disabled className="ml-auto">
              Uploading…
            </Button>
          )}
        </>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        {content}
        {footer}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      {content}
      {footer}
    </div>
  )
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

function folderOf(relativePath: string): string {
  const parts = relativePath.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

function groupByFolder(queue: QueuedFile[]) {
  const map = new Map<string, { item: QueuedFile; index: number }[]>()

  queue.forEach((item, index) => {
    const folder = folderOf(item.relativePath)
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder)!.push({ item, index })
  })

  return Array.from(map.entries()).map(([folder, files]) => ({ folder, files }))
}
