import { api } from './client'

export type Document = {
  id: string
  filename: string
  size: number
  created_at: string
}

export const documentsApi = {
  list: () => api.get<Document[]>('/documents'),

  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.upload<Document>('/documents', form)
  },

  delete: (id: string) => api.del<void>(`/documents/${id}`),
}
