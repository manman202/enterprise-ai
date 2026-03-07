import { Document } from '@/api/documents'
import { Button } from '@/components/ui/Button'

interface DocumentListProps {
  documents: Document[]
  onDelete: (id: string) => void
  deleting: string | null
}

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

export function DocumentList({ documents, onDelete, deleting }: DocumentListProps) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No documents yet.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
          <th className="pb-2 pr-4 font-medium">Filename</th>
          <th className="pb-2 pr-4 font-medium">Size</th>
          <th className="pb-2 pr-4 font-medium">Uploaded</th>
          <th className="pb-2 font-medium" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {documents.map((doc) => (
          <tr key={doc.id}>
            <td className="py-3 pr-4 text-gray-100 font-medium">{doc.filename}</td>
            <td className="py-3 pr-4 text-gray-400">{formatBytes(doc.size)}</td>
            <td className="py-3 pr-4 text-gray-400">{formatDate(doc.created_at)}</td>
            <td className="py-3 text-right">
              <Button
                variant="danger"
                size="sm"
                loading={deleting === doc.id}
                onClick={() => onDelete(doc.id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
