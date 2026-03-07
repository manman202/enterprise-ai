import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

type HealthStatus = {
  api: string
  postgres: string
  chromadb: string
  ollama: string
}

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
      <PageHeader title="System Health" />

      {loading && <p className="text-gray-400 text-sm">Checking...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {status && (
        <Card>
          <table className="w-full text-sm border-separate border-spacing-y-1.5">
            <tbody>
              {Object.entries(status).map(([service, value]) => (
                <tr key={service}>
                  <td className="text-gray-400 capitalize pr-8">{service}</td>
                  <td>
                    <Badge variant={value === 'ok' ? 'ok' : 'error'}>{value}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
