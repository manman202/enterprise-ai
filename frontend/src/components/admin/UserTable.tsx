import { AuthUser } from '@/api/auth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface UserTableProps {
  users: AuthUser[]
  currentUserId: string
  pendingId: string | null
  onToggleActive: (user: AuthUser) => void
  onToggleAdmin: (user: AuthUser) => void
  onDelete: (user: AuthUser) => void
}

export function UserTable({
  users,
  currentUserId,
  pendingId,
  onToggleActive,
  onToggleAdmin,
  onDelete,
}: UserTableProps) {
  if (users.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No users found.</p>
  }

  return (
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
          const isSelf = user.id === currentUserId
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
                    onClick={() => onToggleActive(user)}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isPending}
                    disabled={isSelf}
                    onClick={() => onToggleAdmin(user)}
                  >
                    {user.is_admin ? 'Remove admin' : 'Make admin'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending}
                    disabled={isSelf}
                    onClick={() => onDelete(user)}
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
  )
}
