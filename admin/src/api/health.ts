import { api } from './client'

export type ServiceStatus = 'ok' | 'error'

export type HealthResponse = {
  status: ServiceStatus
  services: {
    postgres: ServiceStatus
    chromadb: ServiceStatus
    ollama:   ServiceStatus
  }
}

export const healthApi = {
  check: () => api.get<HealthResponse>('/health'),
}
