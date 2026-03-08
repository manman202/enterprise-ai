import { api } from './client'

export type AuthUser = {
  id: string
  username: string
  email: string
  is_active: boolean
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { username, password }),

  me: () => api.get<AuthUser>('/auth/me'),
}
