import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import './styles/theme.css'

export default function App() {
  const { user, initialized, init, logout } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    init().finally(() => setChecking(false))
  }, [init])

  if (checking || !initialized) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-primary)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          A
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={() => {}} />
  }

  return <ChatPage onLogout={logout} />
}
