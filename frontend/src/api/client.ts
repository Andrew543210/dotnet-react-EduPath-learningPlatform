export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, code?: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

type Session = { token: () => string | null; language: () => string; onUnauthorized: () => void }

let session: Session = { token: () => null, language: () => 'uk', onUnauthorized: () => {} }

export function configureApi(next: Partial<Session>) {
  session = { ...session, ...next }
}

export function currentToken() {
  return session.token()
}

type Query = Record<string, string | number | boolean | null | undefined>

function withQuery(path: string, query?: Query) {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': session.language() }
  const token = session.token()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api${withQuery(path, query)}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, session.language() === 'en'
      ? 'No connection to the server. Check that the API is running'
      : 'Немає з’єднання з сервером. Перевірте, що API запущено')
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined

  if (!response.ok) {
    if (response.status === 401 && token) session.onUnauthorized()
    const message =
      data?.detail ??
      data?.title ??
      (response.status === 429
        ? session.language() === 'en'
          ? 'Too many attempts. Wait a minute and try again'
          : 'Забагато спроб. Зачекайте хвилину й спробуйте знову'
        : `HTTP ${response.status}`)
    throw new ApiError(response.status, message, data?.code, data?.errors ?? {})
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<T>('POST', path, form)
  },
}
