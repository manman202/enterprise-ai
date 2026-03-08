import { useEffect, useState } from 'react'
import { AdminUser } from '@/api/auth'
import { adminApi } from '@/api/admin'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
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

  async function handleToggleActive(user: AdminUser) {
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

  async function handleToggleAdmin(user: AdminUser) {
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

  async function handleDelete(user: AdminUser) {
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
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Username</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id
                const isPending = pendingId === user.id
                return (
                  <tr key={user.id}>
                    <td className="py-3 pr-4 font-medium text-gray-100">
                      {user.username}
                      {isSelf && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={user.is_active ? 'ok' : 'error'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={user.is_admin ? 'warning' : 'neutral'}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={isPending}
                          disabled={isSelf}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={isPending}
                          disabled={isSelf}
                          onClick={() => handleToggleAdmin(user)}
                        >
                          {user.is_admin ? 'Remove admin' : 'Make admin'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={isPending}
                          disabled={isSelf}
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
