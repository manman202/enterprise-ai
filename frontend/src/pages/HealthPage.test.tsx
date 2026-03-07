import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import HealthPage from './HealthPage'
import * as client from '@/api/client'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const mockGet = vi.mocked(client.api.get)

beforeEach(() => {
  mockGet.mockReset()
})

const allOk = { api: 'ok', postgres: 'ok', chromadb: 'ok', ollama: 'ok' }

describe('HealthPage', () => {
  it('shows a loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<HealthPage />)
    expect(screen.getByText('Checking...')).toBeInTheDocument()
  })

  it('renders all services as ok', async () => {
    mockGet.mockResolvedValue(allOk)
    render(<HealthPage />)

    await waitFor(() => expect(screen.queryByText('Checking...')).not.toBeInTheDocument())

    for (const service of ['api', 'postgres', 'chromadb', 'ollama']) {
      expect(screen.getByText(service)).toBeInTheDocument()
    }
    expect(screen.getAllByText('ok')).toHaveLength(4)
  })

  it('colours degraded services red', async () => {
    mockGet.mockResolvedValue({ ...allOk, ollama: 'connection refused' })
    render(<HealthPage />)

    await waitFor(() => expect(screen.queryByText('Checking...')).not.toBeInTheDocument())

    const degraded = screen.getByText('connection refused')
    expect(degraded).toHaveClass('text-red-400')
  })

  it('shows an error message when the request fails', async () => {
    mockGet.mockRejectedValue(new Error('503 Service Unavailable'))
    render(<HealthPage />)

    await waitFor(() => expect(screen.getByText('503 Service Unavailable')).toBeInTheDocument())
  })
})
