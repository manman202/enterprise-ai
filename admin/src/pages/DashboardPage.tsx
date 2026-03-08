import { useEffect, useState } from 'react'
import { healthApi, HealthResponse } from '@/api/health'
import { adminApi, Document } from '@/api/admin'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [docCount, setDocCount] = useState<number | null>(null)

  useEffect(() => {
    healthApi.check()
      .then(setHealth)
      .catch((e: Error) => setHealthError(e.message))

    adminApi.listUsers()
      .then((users) => setUserCount(users.length))
      .catch(() => setUserCount(null))

    adminApi.listDocuments()
      .then((docs: Document[]) => setDocCount(docs.length))
      .catch(() => setDocCount(null))
  }, [])

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Users</p>
          <p className="mt-1 text-3xl font-semibold text-gray-100">
            {userCount ?? '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Documents</p>
          <p className="mt-1 text-3xl font-semibold text-gray-100">
            {docCount ?? '—'}
          </p>
        </Card>
      </div>

      <Card title="Service Health">
        {healthError && <p className="text-sm text-red-400">{healthError}</p>}
        {health && (
          <table className="w-full text-sm border-separate border-spacing-y-1.5">
            <tbody>
              <tr>
                <td className="text-gray-400 pr-8">API</td>
                <td>
                  <Badge variant={health.status === 'ok' ? 'ok' : 'error'}>{health.status}</Badge>
                </td>
              </tr>
              {Object.entries(health.services).map(([service, value]) => (
                <tr key={service}>
                  <td className="text-gray-400 capitalize pr-8">{service}</td>
                  <td>
                    <Badge variant={value === 'ok' ? 'ok' : 'error'}>{value}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!health && !healthError && (
          <p className="text-sm text-gray-400">Checking…</p>
        )}
      </Card>
    </div>
  )
}
