import { useEffect, useState } from 'react'
import { adminApi, Document } from '@/api/admin'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .listDocuments()
      .then(setDocuments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl">
      <PageHeader title="Documents" />
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <Card>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Filename</th>
                <th className="pb-2 pr-4 font-medium">Size</th>
                <th className="pb-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="py-3 pr-4 font-medium text-gray-100">{doc.filename}</td>
                  <td className="py-3 pr-4 text-gray-400">{formatBytes(doc.size)}</td>
                  <td className="py-3 text-gray-400">{formatDate(doc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
