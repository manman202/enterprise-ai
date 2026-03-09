import { useState, useEffect } from 'react'
import { X, User, Server, Bell, Info, ChevronRight, Power } from 'lucide-react'
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

  function NavItem({
    id,
    icon,
    label,
  }: {
    id: Section
    icon: React.ReactNode
    label: string
  }) {
    return (
      <button
        onClick={() => setSection(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          textAlign: 'left',
          fontSize: 13,
          color: 'var(--color-text)',
          borderBottom: '1px solid var(--color-border)',
          background: section === id ? 'var(--color-surface-2)' : 'transparent',
        }}
      >
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={14} style={{ color: 'var(--color-text-faint)' }} />
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-surface)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-primary)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          {section ? section.charAt(0).toUpperCase() + section.slice(1) : 'Settings'}
        </span>
        <button
          onClick={section ? () => setSection(null) : onClose}
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {section === null && (
          <>
            <NavItem id="account" icon={<User size={15} />} label="Account" />
            <NavItem id="server" icon={<Server size={15} />} label="Server" />
            <NavItem id="preferences" icon={<Bell size={15} />} label="Preferences" />
            <NavItem id="about" icon={<Info size={15} />} label="About" />
            <button
              onClick={onLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                textAlign: 'left',
                fontSize: 13,
                color: '#ef4444',
              }}
            >
              <Power size={15} />
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
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Username</label>
        <div style={valueStyle}>{user?.username ?? '—'}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Email</label>
        <div style={valueStyle}>{user?.email ?? '—'}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Department</label>
        <div style={valueStyle}>{user?.department ?? '—'}</div>
      </div>
      <div>
        <label style={labelStyle}>Role</label>
        <div style={valueStyle}>{user?.is_admin ? 'Administrator' : 'User'}</div>
      </div>
    </div>
  )
}

function ServerSection() {
  const [url, setUrl] = useState(getServerUrl())
  const [saved, setSaved] = useState(false)

  async function save() {
    await setServerUrl(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 16 }}>
      <label style={labelStyle}>API Server URL</label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--color-text)',
          outline: 'none',
          marginBottom: 10,
        }}
      />
      <button
        onClick={save}
        style={{
          padding: '7px 14px',
          background: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}

function PreferencesSection() {
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    invoke<boolean>('plugin:autostart|is_enabled').then(setAutostart).catch(() => {})
  }, [])

  async function toggleAutostart() {
    if (autostart) {
      await invoke('plugin:autostart|disable').catch(() => {})
      setAutostart(false)
    } else {
      await invoke('plugin:autostart|enable').catch(() => {})
      setAutostart(true)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
            Launch at startup
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Start Aiyedun when you log in
          </div>
        </div>
        <button
          onClick={toggleAutostart}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: autostart ? 'var(--color-primary)' : 'var(--color-border)',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: autostart ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
    </div>
  )
}

function AboutSection() {
  const [version, setVersion] = useState('1.0.0')

  useEffect(() => {
    invoke<string>('get_app_version').then(setVersion).catch(() => {})
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            fontSize: 22,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          A
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Aiyedun Desktop</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Version {version}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 8 }}>
          Self-hosted enterprise AI assistant.
          <br />
          Offline-first. LAN-only.
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text)',
  padding: '7px 10px',
  background: 'var(--color-surface-2)',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
}
