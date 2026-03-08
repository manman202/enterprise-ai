import { useState } from 'react'
import { AuthUser } from '@/api/auth'
import { settingsApi } from '@/api/settings'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Props {
  user: AuthUser
  onUpdated: () => Promise<void>
}

export function ProfileForm({ user, onUpdated }: Props) {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      await settingsApi.updateProfile({
        username: username !== user.username ? username : undefined,
        email: email !== user.email ? email : undefined,
      })
      await onUpdated()
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-100">Profile</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">Profile updated.</p>}
      <Input
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" loading={loading}>
        Save changes
      </Button>
    </form>
  )
}
