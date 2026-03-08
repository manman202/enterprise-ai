import { AuthUser } from './auth'
import { api } from './client'

export const settingsApi = {
  updateProfile: (patch: { username?: string; email?: string }) =>
    api.patch<AuthUser>('/users/me', patch),

  changePassword: (body: { current_password: string; new_password: string; confirm_password: string }) =>
    api.post<void>('/users/me/password', body),
}
