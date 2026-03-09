/**
 * UploadModal — wraps FileDropZone in an overlay modal.
 * Opened from the UploadCloud button in the sources table row.
 */

import { KnowledgeSource } from '@/api/knowledge_sources'
import FileDropZone, { UploadResult } from './FileDropZone'

interface Props {
  source: KnowledgeSource
  onClose: () => void
  onDone: (results: UploadResult[]) => void
}

export default function UploadModal({ source, onClose, onDone }: Props) {
  const localPath = (source.config as Record<string, string> | null)?.path ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Upload files to <span className="text-[#1e3a5f]">{source.name}</span>
            </h2>
            {localPath && (
              <p className="mt-0.5 text-xs text-gray-400">
                Saving to:{' '}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                  {localPath}
                </code>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Body — FileDropZone in embedded mode */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FileDropZone
            sourceId={source.id}
            sourceName={source.name}
            localPath={localPath}
            embedded
            onDone={(results) => onDone(results)}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
