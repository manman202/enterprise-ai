import { AuthUser } from './auth'
import { api } from './client'

export type { AuthUser as AdminUser }

export const adminApi = {
  listUsers: () => api.get<AuthUser[]>('/admin/users'),

  updateUser: (id: string, patch: { is_active?: boolean; is_admin?: boolean }) =>
    api.patch<AuthUser>(`/admin/users/${id}`, patch),

  deleteUser: (id: string) => api.del<void>(`/admin/users/${id}`),
}
