import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AdminUser, authApi } from '@/api/auth'
import { TOKEN_KEY } from '@/api/client'

type AuthContextValue = {
  user: AdminUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then((me) => {
        if (!me.is_admin) {
          localStorage.removeItem(TOKEN_KEY)
        } else {
          setUser(me)
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await authApi.login(username, password)
    localStorage.setItem(TOKEN_KEY, access_token)
    const me = await authApi.me()
    if (!me.is_admin) {
      localStorage.removeItem(TOKEN_KEY)
      throw new Error('Access denied: admin privileges required')
    }
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
