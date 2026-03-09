import { useState, useEffect } from 'react'
import { Eye, EyeOff, Server } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getServerUrl, setServerUrl } from '../api/client'

interface Props {
  onLogin: () => void
}

export function LoginPage({ onLogin }: Props) {
  const { login, loading } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [serverUrl, setServerUrlState] = useState('')
  const [showServer, setShowServer] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setServerUrlState(getServerUrl())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setError('')

    // Update server URL if changed
    if (serverUrl.trim() && serverUrl.trim() !== getServerUrl()) {
      await setServerUrl(serverUrl.trim())
    }

    try {
      await login(username.trim(), password)
      onLogin()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Login failed. Check your credentials.')
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0f2444 0%, #1e3a5f 60%, #2a4f7c 100%)',
        padding: 24,
      }}
    >
      {/* Logo area */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 24,
            fontWeight: 700,
            color: '#fff',
            backdropFilter: 'blur(4px)',
          }}
        >
          A
        </div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>
          Aiyedun
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
          Enterprise AI Assistant
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 340,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          borderRadius: 16,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* Server URL toggle */}
        <button
          type="button"
          onClick={() => setShowServer((s) => !s)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            marginBottom: showServer ? 8 : 12,
          }}
        >
          <Server size={11} />
          {showServer ? 'Hide server settings' : 'Change server URL'}
        </button>

        {showServer && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrlState(e.target.value)}
              placeholder="https://api.aiyedun.online"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username or email"
            autoComplete="username"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16, position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              color: '#fca5a5',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 0',
            background: loading ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
            color: loading ? 'rgba(255,255,255,0.5)' : '#1e3a5f',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.15s',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  outline: 'none',
}
