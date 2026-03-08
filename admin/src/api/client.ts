export const TOKEN_KEY = 'aiyedun_admin_token'

type ApiError = { detail?: string | { msg: string }[] }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({}))
    const detail = err.detail
    if (Array.isArray(detail)) throw new Error(detail.map((d) => d.msg).join('; '))
    throw new Error((detail as string | undefined) ?? `${res.status} ${res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                        => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)         => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)         => request<T>('PATCH',  path, body),
  del:    <T>(path: string)                        => request<T>('DELETE', path),
}
