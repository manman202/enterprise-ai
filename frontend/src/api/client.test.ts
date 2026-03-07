import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function makeResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(body),
  } as Response)
}

describe('api.get', () => {
  it('fetches the correct URL and returns parsed JSON', async () => {
    mockFetch.mockReturnValue(makeResponse({ result: 'ok' }))

    const data = await api.get<{ result: string }>('/health')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    )
    expect(data).toEqual({ result: 'ok' })
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockReturnValue(makeResponse({}, false, 500))

    await expect(api.get('/health')).rejects.toThrow('500')
  })
})

describe('api.post', () => {
  it('sends a POST with a JSON body', async () => {
    mockFetch.mockReturnValue(makeResponse({ id: 1 }))

    const data = await api.post<{ id: number }>('/items', { name: 'doc' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'doc' }),
      }),
    )
    expect(data).toEqual({ id: 1 })
  })
})

describe('api.del', () => {
  it('sends a DELETE request', async () => {
    mockFetch.mockReturnValue(makeResponse(null, true, 204))

    await api.del('/documents/123')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/documents/123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockReturnValue(makeResponse({}, false, 404))

    await expect(api.del('/documents/missing')).rejects.toThrow('404')
  })
})

describe('api.upload', () => {
  it('sends a POST with FormData (no Content-Type header)', async () => {
    mockFetch.mockReturnValue(makeResponse({ id: 'abc' }))
    const form = new FormData()

    await api.upload('/documents', form)

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/documents', {
      method: 'POST',
      body: form,
    })
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockReturnValue(makeResponse({}, false, 500))

    await expect(api.upload('/documents', new FormData())).rejects.toThrow('500')
  })
})
