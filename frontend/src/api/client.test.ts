import { api, ApiError, configureApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  configureApi({ token: () => null, language: () => 'uk', onUnauthorized: () => {} })
})

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('api client', () => {
  it('sends the token, the interface language and query parameters', async () => {
    const fn = stubFetch(200, { ok: true })
    configureApi({ token: () => 'abc', language: () => 'en' })
    await api.get('/courses', { search: 'sql', page: 2, empty: '', skip: undefined })
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/courses?search=sql&page=2')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc', 'Accept-Language': 'en' })
  })

  it('turns ProblemDetails into ApiError with field errors', async () => {
    stubFetch(400, { title: 'Bad', detail: 'Перевірте поля', code: 'validation', errors: { email: ['Невірний email'] } })
    const error = await api.post('/auth/register', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Перевірте поля', code: 'validation', fieldErrors: { email: ['Невірний email'] } })
  })

  it('signs the user out when an authorised request gets 401', async () => {
    stubFetch(401, { title: 'Unauthorized' })
    const onUnauthorized = vi.fn()
    configureApi({ token: () => 'expired', onUnauthorized })
    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('reports a missing server in the user language', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    configureApi({ language: () => 'en' })
    await expect(api.get('/courses')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('No connection') })
  })

  it('returns undefined for 204 responses', async () => {
    stubFetch(204)
    await expect(api.delete('/notifications/1')).resolves.toBeUndefined()
  })
})
