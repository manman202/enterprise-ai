import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/chat', { replace: true })
  }, [user, navigate])

  async function handleLogin(username: string, password: string) {
    await login(username, password)
    navigate('/chat', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-100">Aiyedun</h1>
          <p className="mt-1 text-sm text-gray-500">Enterprise AI Knowledge Staff</p>
        </div>
        <LoginForm onSubmit={handleLogin} />
      </div>
    </div>
  )
}
