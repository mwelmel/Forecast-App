const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
  const headers = new Headers(options.headers)

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? data.detail : null
    throw new Error(typeof detail === 'string' ? detail : 'Permintaan ke server gagal diproses.')
  }

  return data as T
}
