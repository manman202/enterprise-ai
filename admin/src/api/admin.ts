import { AdminUser } from './auth'
import { api } from './client'

export type { AdminUser }

export type Document = {
  id: string
  filename: string
  size: number
  created_at: string
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users'),

  updateUser: (id: string, patch: { is_active?: boolean; is_admin?: boolean }) =>
    api.patch<AdminUser>(`/admin/users/${id}`, patch),

  deleteUser: (id: string) => api.del<void>(`/admin/users/${id}`),

  listDocuments: () => api.get<Document[]>('/documents'),
}
