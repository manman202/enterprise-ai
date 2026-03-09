import { create } from 'zustand'
import { login as apiLogin, logout as apiLogout, getMe, UserInfo, initServerUrl } from '../api/client'

export interface AuthState {
  user: UserInfo | null
  token: string | null
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    await initServerUrl()
    try {
      // Try fetching current user — if token valid it succeeds
      const user = await getMe()
      set({ user, initialized: true })
    } catch {
      set({ user: null, token: null, initialized: true })
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true })
    try {
      const data = await apiLogin(username, password)
      const user = await getMe()
      set({ user, token: data.access_token, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: async () => {
    await apiLogout()
    set({ user: null, token: null })
  },
}))
