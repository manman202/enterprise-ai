import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface RegisterFormProps {
  onSubmit: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = username && email && password && confirmPassword

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit(username, email, password, confirmPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <Input
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" loading={loading} disabled={!canSubmit}>
        Create account
      </Button>
    </form>
  )
}
