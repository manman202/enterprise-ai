import { useEffect, useState } from 'react'
import { api } from '@/api/client'

type HealthStatus = {
  api: string
  postgres: string
  chromadb: string
  ollama: string
}

const statusColor = (s: string) =>
  s === 'ok' ? 'text-green-400' : 'text-red-400'

export default function HealthPage() {
  const [status, setStatus] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<HealthStatus>('/health')
      .then(setStatus)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-4">System Health</h1>

      {loading && <p className="text-gray-400 text-sm">Checking...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {status && (
        <table className="w-full text-sm border-separate border-spacing-y-1">
          <tbody>
            {Object.entries(status).map(([service, value]) => (
              <tr key={service}>
                <td className="text-gray-400 capitalize pr-8">{service}</td>
                <td className={statusColor(value)}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
