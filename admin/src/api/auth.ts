import { api } from './client'

export type AdminUser = {
  id: string
  username: string
  email: string
  is_active: boolean
  is_admin: boolean
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; token_type: string }>('/auth/login', { username, password }),

  me: () => api.get<AdminUser>('/auth/me'),
}
