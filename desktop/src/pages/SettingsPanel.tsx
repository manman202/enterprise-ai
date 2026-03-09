import { useState, useEffect } from 'react'
import { X, User, Server, Bell, Info, ChevronRight, ChevronLeft, Power } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore, AuthState } from '../store/authStore'
import { getServerUrl, setServerUrl } from '../api/client'

type Section = 'account' | 'server' | 'preferences' | 'about'

interface Props {
  onClose: () => void
  onLogout: () => void
}

export function SettingsPanel({ onClose, onLogout }: Props) {
  const [section, setSection] = useState<Section | null>(null)
  const { user } = useAuthStore()

  function NavItem({ id, icon, label }: { id: Section; icon: React.ReactNode; label: string }) {
    return (
      <button
        onClick={() => setSection(id)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', background: 'transparent' }}
      >
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={13} style={{ color: 'var(--color-text-faint)' }} />
      </button>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-surface)', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-primary)', flexShrink: 0 }}>
        {section && (
          <button onClick={() => setSection(null)} style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} />
          </button>
        )}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff' }}>
          {section ? section.charAt(0).toUpperCase() + section.slice(1) : 'Settings'}
        </span>
        <button onClick={section ? () => setSection(null) : onClose} style={{ color: 'rgba(255,255,255,0.7)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {section === null && (
          <>
            <NavItem id="account" icon={<User size={14} />} label="Account" />
            <NavItem id="server" icon={<Server size={14} />} label="Server" />
            <NavItem id="preferences" icon={<Bell size={14} />} label="Preferences" />
            <NavItem id="about" icon={<Info size={14} />} label="About" />
            <button
              onClick={onLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: '#ef4444', borderTop: '1px solid var(--color-border)', marginTop: 8 }}
            >
              <Power size={14} />
              Sign Out
            </button>
          </>
        )}
        {section === 'account' && <AccountSection user={user} />}
        {section === 'server' && <ServerSection />}
        {section === 'preferences' && <PreferencesSection />}
        {section === 'about' && <AboutSection />}
      </div>
    </div>
  )
}

function AccountSection({ user }: { user: AuthState['user'] }) {
  const rows: [string, string][] = [
    ['Username', user?.username ?? '—'],
    ['Email', user?.email ?? '—'],
    ['Department', user?.department ?? '—'],
    ['Role', user?.is_admin ? 'Administrator' : 'User'],
  ]
  return (
    <div style={{ padding: 14 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={labelStyle}>{label}</div>
          <div style={valueStyle}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function ServerSection() {
  const [url, setUrl] = useState(getServerUrl())
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  async function save() {
    await setServerUrl(url)
    setStatus('idle')
  }

  async function testConnection() {
    setStatus('testing')
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/api/v1/health`, { signal: AbortSignal.timeout(5000) })
      setStatus(r.ok ? 'ok' : 'fail')
    } catch {
      setStatus('fail')
    }
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={labelStyle}>API Server URL</div>
      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...valueStyle, width: '100%', marginBottom: 8, padding: '7px 10px' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} style={btnStyle}>Save</button>
        <button onClick={testConnection} disabled={status === 'testing'} style={{ ...btnStyle, background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
          {status === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      {status === 'ok' && <div style={{ marginTop: 6, fontSize: 11, color: '#10b981' }}>✓ Connection successful</div>}
      {status === 'fail' && <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>✗ Could not connect</div>}
    </div>
  )
}

function PreferencesSection() {
  const [autostart, setAutostart] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [shortcut] = useState('Ctrl+Shift+A')

  useEffect(() => {
    invoke<boolean>('plugin:autostart|is_enabled').then(setAutostart).catch(() => {})
    const saved = localStorage.getItem('aiyedun_notifications')
    if (saved !== null) setNotifications(saved === 'true')
    const savedTheme = localStorage.getItem('aiyedun_theme') as typeof theme | null
    if (savedTheme) setTheme(savedTheme)
  }, [])

  async function toggleAutostart() {
    const next = !autostart
    if (next) {
      await invoke('plugin:autostart|enable').catch(() => {})
    } else {
      await invoke('plugin:autostart|disable').catch(() => {})
    }
    setAutostart(next)
  }

  function toggleNotifications() {
    const next = !notifications
    setNotifications(next)
    localStorage.setItem('aiyedun_notifications', String(next))
  }

  function setThemeValue(t: typeof theme) {
    setTheme(t)
    localStorage.setItem('aiyedun_theme', t)
    // Apply theme
    const root = document.documentElement
    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
  }

  return (
    <div style={{ padding: 14 }}>
      <PrefRow
        label="Launch at startup"
        description="Start Aiyedun when you log in"
        checked={autostart}
        onToggle={toggleAutostart}
      />
      <PrefRow
        label="Notifications"
        description="Show OS notifications for new replies"
        checked={notifications}
        onToggle={toggleNotifications}
      />
      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', marginBottom: 2 }}>Global shortcut</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>Toggle window</div>
        <div style={{ padding: '4px 8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', display: 'inline-block', color: 'var(--color-text)' }}>
          {shortcut}
        </div>
      </div>
      <div style={{ padding: '10px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', marginBottom: 8 }}>Theme</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setThemeValue(t)}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: theme === t ? 600 : 400,
                background: theme === t ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: theme === t ? '#fff' : 'var(--color-text-muted)',
                border: `1px solid ${theme === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PrefRow({ label, description, checked, onToggle }: { label: string; description: string; checked: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{description}</div>
      </div>
      <button
        onClick={onToggle}
        style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function AboutSection() {
  const [version, setVersion] = useState('1.0.0')
  const buildDate = new Date().toLocaleDateString()

  useEffect(() => {
    invoke<string>('get_app_version').then(setVersion).catch(() => {})
  }, [])

  return (
    <div style={{ padding: 14 }}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 22, fontWeight: 700, color: '#fff' }}>A</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Aiyedun Desktop</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Version {version}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>Built {buildDate}</div>
        <button style={{ marginTop: 12, ...btnStyle }}>Check for updates</button>
        <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 16, lineHeight: 1.5 }}>
          Self-hosted enterprise AI assistant.<br />Offline-first. LAN-only.
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text)',
  padding: '6px 10px',
  background: 'var(--color-surface-2)',
  borderRadius: 7,
  border: '1px solid var(--color-border)',
}

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--color-primary)',
  color: '#fff',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}
