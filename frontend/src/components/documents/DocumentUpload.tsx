import { ChangeEvent, FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>
}

export function DocumentUpload({ onUpload }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null)
    setFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      await onUpload(file)
      setFile(null)
      const input = document.getElementById('doc-file-input') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-col gap-1 flex-1">
        <label htmlFor="doc-file-input" className="text-sm text-gray-300">
          File
        </label>
        <input
          id="doc-file-input"
          type="file"
          accept=".txt,.md,.pdf"
          onChange={handleFileChange}
          className={[
            'rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100',
            'file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1',
            'file:text-xs file:text-gray-200 file:cursor-pointer cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
          ].join(' ')}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <Button type="submit" disabled={!file} loading={loading} className="mb-0.5">
        Upload
      </Button>
    </form>
  )
}
