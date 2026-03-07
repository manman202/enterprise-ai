import { useEffect, useState } from 'react'
import { Document, documentsApi } from '@/api/documents'
import { DocumentList } from '@/components/documents/DocumentList'
import { DocumentUpload } from '@/components/documents/DocumentUpload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function fetchDocuments() {
    try {
      setDocuments(await documentsApi.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function handleUpload(file: File) {
    const doc = await documentsApi.upload(file)
    setDocuments((prev) => [doc, ...prev])
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await documentsApi.delete(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Documents" />

      <Card title="Upload" className="mb-6">
        <DocumentUpload onUpload={handleUpload} />
      </Card>

      <Card title="Knowledge Base">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && (
          <DocumentList documents={documents} onDelete={handleDelete} deleting={deleting} />
        )}
      </Card>
    </div>
  )
}
