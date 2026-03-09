import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { login as apiLogin, me, UserInfo, initServerUrl } from '../api/client'

interface AuthState {
  user: UserInfo | null
  token: string | null
  loading: boolean
  initialized: boolean

  init: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export type { AuthState }

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  initialized: false,

  init: async () => {
    await initServerUrl()
    try {
      const token = await invoke<string | null>('get_token')
      if (token) {
        const user = await me()
        set({ user, token, initialized: true })
      } else {
        set({ initialized: true })
      }
    } catch {
      await invoke('clear_auth').catch(() => {})
      set({ user: null, token: null, initialized: true })
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true })
    try {
      const data = await apiLogin(username, password)
      await invoke('save_token', { token: data.access_token })
      const user = await me()
      set({ user, token: data.access_token, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: async () => {
    await invoke('clear_auth').catch(() => {})
    set({ user: null, token: null })
  },
}))
