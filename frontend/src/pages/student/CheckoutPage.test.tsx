import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutPage from './CheckoutPage'
import type { CourseDetails } from '@/api/types'
import { mockFetch, renderRoutes, signIn } from '@/test/render'

const details: CourseDetails = {
  course: {
    id: 6,
    title: 'SQL для аналітиків',
    summary: 'Запити до реальної бази',
    price: 450,
    level: 'Beginner',
    status: 'Published',
    categoryId: 1,
    categoryName: 'Аналітика даних',
    trail: 'Green',
    teacherId: 3,
    teacherName: 'Тарас Гнатюк',
    lessonCount: 1,
    durationMinutes: 20,
    studentCount: 10,
    rating: null,
    reviewCount: 0,
    publishedAt: null,
    updatedAt: '2026-08-01T00:00:00Z',
  },
  description: '',
  outcomes: [],
  teacher: { id: 3, name: 'Тарас Гнатюк', headline: null, bio: null, courseCount: 1, studentCount: 10 },
  lessons: [],
  testCount: 0,
  learner: null,
  isPreview: false,
  moderationComment: null,
}

const routes = [
  { path: '/courses/:id/checkout', element: <CheckoutPage /> },
  { path: '/payments/:id', element: <p>receipt page</p> },
]

afterEach(() => vi.unstubAllGlobals())

describe('CheckoutPage (sandbox payments)', () => {
  beforeEach(() => signIn('Student'))

  it('rejects an invalid card on the client without charging anything', async () => {
    const { calls } = mockFetch({ 'GET /courses/6': () => ({ body: details }) })
    renderRoutes(routes, { path: '/courses/6/checkout', language: 'en' })
    await userEvent.type(await screen.findByLabelText('Card number'), '4242 4242 4242 4241')
    await userEvent.type(screen.getByLabelText('Expiry'), '0120')
    await userEvent.type(screen.getByLabelText('CVC'), '1')
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    expect(screen.getByText('The card number is invalid: check the digits')).toBeInTheDocument()
    expect(screen.getByText('The card has expired')).toBeInTheDocument()
    expect(screen.getByText('CVC must be three or four digits')).toBeInTheDocument()
    expect(screen.getByText('Enter the cardholder name')).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/payments/checkout')).toBe(false)
  })

  it('pays with a sandbox test card and opens the receipt', async () => {
    const { calls } = mockFetch({
      'GET /courses/6': () => ({ body: details }),
      'POST /payments/checkout': () => ({ body: { id: 42, status: 'Succeeded' } }),
    })
    const { router } = renderRoutes(routes, { path: '/courses/6/checkout', language: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /4242 4242 4242 4242/ }))
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242')
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    expect(await screen.findByText('receipt page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/payments/42')
    expect(calls.find((c) => c.path === '/payments/checkout')?.body).toMatchObject({
      courseId: 6,
      cardNumber: '4242424242424242',
      expiry: '12/30',
      cvc: '123',
    })
  })

  it('maps server validation errors onto the fields', async () => {
    mockFetch({
      'GET /courses/6': () => ({ body: details }),
      'POST /payments/checkout': () => ({
        status: 400,
        body: { title: 'Validation', code: 'validation', errors: { cvc: ['CVC не підходить'] } },
      }),
    })
    renderRoutes(routes, { path: '/courses/6/checkout', language: 'en' })
    await userEvent.click(await screen.findByRole('button', { name: /4242 4242 4242 4242/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }))
    expect(await screen.findByText('CVC не підходить')).toBeInTheDocument()
  })
})
