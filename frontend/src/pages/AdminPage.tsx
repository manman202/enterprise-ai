import { useEffect, useState } from 'react'
import { AuthUser } from '@/api/auth'
import { adminApi } from '@/api/admin'
import { UserTable } from '@/components/admin/UserTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .listUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggleActive(user: AuthUser) {
    setPendingId(user.id)
    try {
      const updated = await adminApi.updateUser(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setPendingId(null)
    }
  }

  async function handleToggleAdmin(user: AuthUser) {
    setPendingId(user.id)
    try {
      const updated = await adminApi.updateUser(user.id, { is_admin: !user.is_admin })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(user: AuthUser) {
    setPendingId(user.id)
    try {
      await adminApi.deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="User Management" />
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <Card>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <UserTable
            users={users}
            currentUserId={currentUser?.id ?? ''}
            pendingId={pendingId}
            onToggleActive={handleToggleActive}
            onToggleAdmin={handleToggleAdmin}
            onDelete={handleDelete}
          />
        )}
      </Card>
    </div>
  )
}
