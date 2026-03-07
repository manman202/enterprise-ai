import { api } from './client'

export type SearchResult = {
  document_id: string
  filename: string
  excerpt: string
  score: number
}

export type SearchResponse = {
  query: string
  results: SearchResult[]
}

export const searchApi = {
  search: (query: string, n_results = 5) =>
    api.post<SearchResponse>('/search', { query, n_results }),
}
