import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/chat', { replace: true })
  }, [user, navigate])

  async function handleRegister(
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) {
    await authApi.register(username, email, password, confirmPassword)
    await login(username, password)
    navigate('/chat', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-100">Aiyedun</h1>
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>
        <RegisterForm onSubmit={handleRegister} />
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
