import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AdminUser } from '@/api/auth'
import { adminApi } from '@/api/admin'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'

// ── Avatar helper ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500',
  'bg-yellow-500', 'bg-rose-500', 'bg-indigo-500',
]

function avatarColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(user: AdminUser): string {
  const parts = (user.username ?? '').split(/[\s._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (user.username ?? '?').slice(0, 2).toUpperCase()
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users,     setUsers]     = useState<AdminUser[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Filters
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter,    setRoleFilter]    = useState<'all' | 'admin' | 'user'>('all')

  useEffect(() => {
    adminApi
      .listUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) => {
      if (q && !u.username.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false
      }
      if (statusFilter === 'active'   && !u.is_active) return false
      if (statusFilter === 'inactive' &&  u.is_active) return false
      if (roleFilter   === 'admin'    && !u.is_admin)  return false
      if (roleFilter   === 'user'     &&  u.is_admin)  return false
      return true
    })
  }, [users, search, statusFilter, roleFilter])

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
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
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
    <div className="max-w-7xl space-y-4">
      <PageHeader title="User Management" />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm
                       text-gray-800 placeholder-gray-400 focus:border-blue-400
                       focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm
                     text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm
                     text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>

        <span className="ml-auto text-sm text-gray-500">
          Showing {filtered.length} of {users.length} users
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                    No users found.
                  </td>
                </tr>
              )
              : filtered.map((user) => {
                  const isSelf    = user.id === currentUser?.id
                  const isPending = pendingId === user.id
                  const color     = avatarColor(user.username)

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      {/* Avatar + username */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center
                                        rounded-full text-xs font-bold text-white ${color}`}
                          >
                            {initials(user)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.username}
                              {isSelf && (
                                <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-500">{user.email}</td>

                      {/* Department — not on AdminUser yet, show dash */}
                      <td className="px-4 py-3 text-gray-400">—</td>

                      <td className="px-4 py-3">
                        <Badge variant={user.is_admin ? 'warning' : 'neutral'}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={user.is_active ? 'ok' : 'error'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Last login — not in API yet */}
                      <td className="px-4 py-3 text-gray-400">—</td>

                      <td className="px-4 py-3">
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
                            {user.is_admin ? 'Demote' : 'Promote'}
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
      </div>
    </div>
  )
}
