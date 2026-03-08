/**
 * UploadModal — drag & drop file/folder upload for local knowledge sources.
 *
 * Three input methods:
 *   1. Drag & drop files from desktop
 *   2. Drag & drop an entire folder (recursive via webkitGetAsEntry)
 *   3. Click "Browse Files" or "Browse Folder" buttons
 *   4. Enter a VPS path and scan it via the scan-path API
 */

import { DragEvent, useRef, useState } from 'react'
import {
  Upload, FolderOpen, FileText, X, CheckCircle, AlertCircle,
  RefreshCw, Search,
} from 'lucide-react'
import { KnowledgeSource } from '@/api/knowledge_sources'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/api/client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueuedFile {
  file: File
  relativePath: string  // '' for direct files, 'folder/sub/file.pdf' for folder uploads
}

interface UploadResult {
  filename: string
  size: number
  status: 'ingested' | 'error' | 'rejected'
  error: string | null
  chunks_created: number | null
}

type UploadPhase = 'select' | 'uploading' | 'done'

const ALLOWED_EXTS = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function isSupported(name: string): boolean {
  return ALLOWED_EXTS.has(fileExt(name))
}

/** Walk a webkitEntry directory recursively and collect all supported files. */
async function walkEntry(
  entry: FileSystemEntry,
  path = '',
): Promise<{ file: File; relativePath: string }[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    return new Promise((resolve) => {
      fileEntry.file((f) => {
        if (isSupported(f.name)) {
          resolve([{ file: f, relativePath: path ? `${path}/${f.name}` : f.name }])
        } else {
          resolve([])
        }
      })
    })
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const allEntries: FileSystemEntry[] = []

    // readEntries returns at most 100 entries at a time — loop until empty
    await new Promise<void>((resolve) => {
      function read() {
        reader.readEntries((batch) => {
          if (batch.length === 0) { resolve(); return }
          allEntries.push(...batch)
          read()
        })
      }
      read()
    })

    const subName = path ? `${path}/${entry.name}` : entry.name
    const results = await Promise.all(allEntries.map((e) => walkEntry(e, subName)))
    return results.flat()
  }

  return []
}

// ── UploadModal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  source: KnowledgeSource
  onClose: () => void
  onDone: () => void
}

export default function UploadModal({ source, onClose, onDone }: UploadModalProps) {
  const localPath = (source.config as Record<string, string> | null)?.path ?? ''

  const [phase,      setPhase]      = useState<UploadPhase>('select')
  const [queue,      setQueue]      = useState<QueuedFile[]>([])
  const [dragging,   setDragging]   = useState(false)
  const [results,    setResults]    = useState<UploadResult[]>([])
  const [uploading,  setUploading]  = useState(false)
  const [progress,   setProgress]   = useState(0)

  // VPS path scan
  const [scanPath,   setScanPath]   = useState('')
  const [scanning,   setScanning]   = useState(false)
  const [scanError,  setScanError]  = useState<string | null>(null)

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // ── File collection helpers ────────────────────────────────────────────────

  function addFiles(files: File[], basePath = '') {
    const newItems: QueuedFile[] = []
    for (const f of files) {
      if (!isSupported(f.name)) continue
      // Deduplicate by name+size
      const key = `${f.name}-${f.size}`
      if (queue.some((q) => `${q.file.name}-${q.file.size}` === key)) continue
      newItems.push({ file: f, relativePath: basePath ? `${basePath}/${f.name}` : f.name })
    }
    setQueue((prev) => [...prev, ...newItems])
  }

  function removeFile(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Drag & drop handlers ───────────────────────────────────────────────────

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)

    const items = Array.from(e.dataTransfer.items)
    const collected: QueuedFile[] = []

    for (const item of items) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()

      if (entry) {
        // Use the FileSystem API to handle both files and folders recursively
        const walked = await walkEntry(entry, '')
        collected.push(...walked)
      } else {
        // Fallback: plain File
        const f = item.getAsFile()
        if (f && isSupported(f.name)) {
          collected.push({ file: f, relativePath: f.name })
        }
      }
    }

    // Deduplicate against existing queue
    setQueue((prev) => {
      const existing = new Set(prev.map((q) => `${q.file.name}-${q.file.size}`))
      const novel = collected.filter((c) => !existing.has(`${c.file.name}-${c.file.size}`))
      return [...prev, ...novel]
    })
  }

  // ── File input handlers ────────────────────────────────────────────────────

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function onFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    // webkitRelativePath gives e.g. "FolderName/sub/file.pdf"
    const items: QueuedFile[] = files
      .filter((f) => isSupported(f.name))
      .map((f) => ({
        file: f,
        relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      }))
    setQueue((prev) => [...prev, ...items])
    e.target.value = ''
  }

  // ── VPS path scan ──────────────────────────────────────────────────────────

  async function handleScan() {
    if (!scanPath.trim()) return
    setScanning(true)
    setScanError(null)
    try {
      const result = await api.get<{
        path: string
        files: { name: string; size: number; relative_path: string }[]
        supported: number
      }>('/knowledge-sources/scan-path', { path: scanPath.trim() })

      if (result.files.length === 0) {
        setScanError(`No supported files found at ${result.path}`)
        return
      }

      // These are server-side files — we can't actually add File objects for them,
      // so we indicate them in the queue with a special marker (size only, no File)
      // We'll handle them differently during upload via a separate path param.
      // For now, show the count and let user confirm.
      setScanError(null)
      alert(
        `Found ${result.supported} supported files at ${result.path}.\n\n` +
        `To ingest these, use "Sync Now" on the source — the sync scheduler will ` +
        `pick them up automatically since they are already on the VPS filesystem.`
      )
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (queue.length === 0) return
    setUploading(true)
    setPhase('uploading')
    setProgress(0)

    // Upload in batches of 5 to avoid overwhelming the server
    const BATCH = 5
    const allResults: UploadResult[] = []

    for (let i = 0; i < queue.length; i += BATCH) {
      const batch = queue.slice(i, i + BATCH)
      const formData = new FormData()
      for (const item of batch) {
        formData.append('files', item.file, item.file.name)
      }

      try {
        const token = localStorage.getItem('aiyedun_admin_token')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`/api/v1/knowledge-sources/${source.id}/upload`, {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const detail = (err as { detail?: string }).detail ?? `HTTP ${res.status}`
          // Mark all files in this batch as errored
          for (const item of batch) {
            allResults.push({
              filename: item.file.name,
              size: item.file.size,
              status: 'error',
              error: detail,
              chunks_created: null,
            })
          }
        } else {
          const data = await res.json() as { uploaded: UploadResult[] }
          allResults.push(...data.uploaded)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed'
        for (const item of batch) {
          allResults.push({
            filename: item.file.name,
            size: item.file.size,
            status: 'error',
            error: msg,
            chunks_created: null,
          })
        }
      }

      setProgress(Math.round(((i + BATCH) / queue.length) * 100))
    }

    setResults(allResults)
    setUploading(false)
    setPhase('done')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalSize = queue.reduce((sum, q) => sum + q.file.size, 0)
  const okCount = results.filter((r) => r.status === 'ingested').length
  const errCount = results.filter((r) => r.status !== 'ingested').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Upload files to <span className="text-[#1e3a5f]">{source.name}</span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Uploading to: <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{localPath || '—'}</code>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Select phase ── */}
          {phase === 'select' && (
            <>
              {/* Drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={[
                  'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                  dragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                ].join(' ')}
              >
                <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-blue-400' : 'text-gray-300'}`} />
                <p className={`text-sm font-medium ${dragging ? 'text-blue-600' : 'text-gray-500'}`}>
                  {dragging ? 'Drop files or folders here' : 'Drag & drop files or folders here'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Supports .pdf, .docx, .doc, .xlsx, .xls, .txt, .md — max 50 MB per file
                </p>

                {/* Browse buttons */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white
                               px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <FileText size={13} /> Browse Files
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white
                               px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <FolderOpen size={13} /> Browse Folder
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
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
                // @ts-expect-error — webkitdirectory is non-standard but widely supported
                webkitdirectory=""
                mozdirectory=""
                className="hidden"
                onChange={onFolderInputChange}
              />

              {/* VPS path scan */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Or scan a VPS path
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scanPath}
                    onChange={(e) => setScanPath(e.target.value)}
                    placeholder="/mnt/shares/HR"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm
                               focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <Button variant="secondary" size="sm" loading={scanning} onClick={handleScan}>
                    <Search size={13} /> Scan
                  </Button>
                </div>
                {scanError && (
                  <p className="mt-1.5 text-xs text-red-500">{scanError}</p>
                )}
                <p className="mt-1.5 text-xs text-gray-400">
                  Scans a path already on the VPS server. Files found can be ingested via Sync Now.
                </p>
              </div>

              {/* File list */}
              {queue.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600">
                      {queue.length} file{queue.length !== 1 ? 's' : ''} ready — {formatBytes(totalSize)}
                    </p>
                    <button
                      onClick={() => setQueue([])}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                    {queue.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <FileText size={13} className="shrink-0 text-gray-400" />
                        <span className="flex-1 truncate text-gray-700">
                          {item.relativePath || item.file.name}
                        </span>
                        <span className="shrink-0 text-gray-400">{formatBytes(item.file.size)}</span>
                        <button
                          onClick={() => removeFile(i)}
                          className="shrink-0 text-gray-300 hover:text-red-400"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Uploading phase ── */}
          {phase === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Spinner size="lg" />
              <p className="text-sm font-medium text-gray-700">
                Uploading and ingesting {queue.length} file{queue.length !== 1 ? 's' : ''}…
              </p>
              {/* Overall progress bar */}
              <div className="w-full max-w-sm">
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-xs text-gray-400">{progress}%</p>
              </div>
            </div>
          )}

          {/* ── Done phase ── */}
          {phase === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {errCount === 0 ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : (
                  <AlertCircle size={20} className="text-yellow-500" />
                )}
                <p className="text-sm font-medium text-gray-800">
                  {okCount} file{okCount !== 1 ? 's' : ''} ingested successfully
                  {errCount > 0 && `, ${errCount} failed`}
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-left font-medium uppercase tracking-wide text-gray-400">
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r, i) => (
                      <tr key={i}>
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-700">
                          {r.filename}
                        </td>
                        <td className="px-3 py-2 text-gray-400">{formatBytes(r.size)}</td>
                        <td className="px-3 py-2">
                          <span className={[
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            r.status === 'ingested'
                              ? 'bg-green-100 text-green-700'
                              : r.status === 'rejected'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700',
                          ].join(' ')}>
                            {r.status === 'ingested' ? (
                              <><CheckCircle size={10} /> Ingested</>
                            ) : r.status === 'rejected' ? (
                              'Rejected'
                            ) : (
                              <><AlertCircle size={10} /> Error</>
                            )}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-red-400">
                          {r.error ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 shrink-0">
          {phase === 'done' ? (
            <>
              <p className="text-xs text-gray-400">
                {okCount} ingested — files saved to <code className="font-mono">{localPath}</code>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setPhase('select'); setQueue([]); setResults([]) }}>
                  <RefreshCw size={13} /> Upload more
                </Button>
                <Button size="sm" onClick={onDone}>Done</Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={uploading}
                disabled={queue.length === 0 || uploading}
                onClick={handleUpload}
              >
                <Upload size={13} />
                Upload {queue.length > 0 ? `${queue.length} file${queue.length !== 1 ? 's' : ''}` : ''}
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
