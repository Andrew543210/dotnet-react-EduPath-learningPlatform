import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, FlaskConical, Lock } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api, ApiError } from '@/api/client'
import type { CourseDetails, Payment } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { checkExpiry, detectBrand, digitsOnly, formatCardNumber, formatExpiry, passesLuhn, testCards } from '@/lib/card'
import { Button, Field, Input } from '@/ui/controls'
import { Callout, Card, CourseCover, ErrorState, Loader, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import s from './Checkout.module.css'

type Errors = Partial<Record<'number' | 'holder' | 'expiry' | 'cvc', string>>

const brandLabel = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX', unknown: '' }

export default function CheckoutPage() {
  const courseId = Number(useParams().id)
  const { t, f } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['course', courseId, 'checkout'], queryFn: () => api.get<CourseDetails>(`/courses/${courseId}`) })

  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const pay = useMutation({
    mutationFn: () =>
      api.post<Payment>('/payments/checkout', {
        courseId,
        cardNumber: digitsOnly(number),
        cardHolder: holder.trim(),
        expiry,
        cvc,
      }),
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['course'] })
      queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.setQueryData(['payment', payment.id], payment)
      navigate(`/payments/${payment.id}`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'validation') {
        const fe = error.fieldErrors
        setErrors({ number: fe.cardNumber?.[0], holder: fe.cardHolder?.[0], expiry: fe.expiry?.[0], cvc: fe.cvc?.[0] })
      } else if (error instanceof ApiError && error.status === 422) setServerError(error.message)
      else toast.error(error)
    },
  })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const { course, learner, lessons } = query.data
  const owned = learner?.enrollmentStatus === 'Active' || learner?.enrollmentStatus === 'Completed'
  if (course.price === 0) return <Navigate to={`/courses/${courseId}`} replace />

  const brand = detectBrand(number)
  const amount = f.money(course.price)

  const validate = (): boolean => {
    const next: Errors = {}
    if (!passesLuhn(number)) next.number = t.checkout.errors.number
    if (holder.trim().length < 2) next.holder = t.checkout.errors.holder
    const exp = checkExpiry(expiry)
    if (exp === 'format') next.expiry = t.checkout.errors.expiryFormat
    if (exp === 'expired') next.expiry = t.checkout.errors.expired
    if (!/^\d{3,4}$/.test(cvc)) next.cvc = t.checkout.errors.cvc
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return (
    <div className={s.page}>
      <PageHeader back={{ to: `/courses/${courseId}`, label: course.title }} title={t.checkout.title} />

      <div className={s.layout}>
        <Card className={s.formCard}>
          {owned ? (
            <Callout tone="success">{t.checkout.owned}</Callout>
          ) : (
            <form
              className={s.form}
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                setServerError(null)
                if (validate()) pay.mutate()
              }}
            >
              <div className={s.cardPreview} aria-hidden data-brand={brand}>
                <div className={s.cardTop}>
                  <CreditCard />
                  <span className={s.cardBrand}>{brandLabel[brand]}</span>
                </div>
                <span className={s.cardNumber}>{formatCardNumber(number) || '•••• •••• •••• ••••'}</span>
                <div className={s.cardBottom}>
                  <span>{holder.trim().toUpperCase() || t.checkout.cardHolder.toUpperCase()}</span>
                  <span>{expiry || 'MM/YY'}</span>
                </div>
              </div>

              {serverError && <Callout tone="danger">{serverError}</Callout>}

              <Field label={t.checkout.cardNumber} error={errors.number}>
                {(id, describedBy, invalid) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={number}
                    onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    mono
                  />
                )}
              </Field>
              <Field label={t.checkout.cardHolder} error={errors.holder}>
                {(id, describedBy, invalid) => (
                  <Input
                    id={id}
                    autoComplete="cc-name"
                    placeholder={t.checkout.cardHolderPlaceholder}
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <div className={s.row}>
                <Field label={t.checkout.expiry} error={errors.expiry}>
                  {(id, describedBy, invalid) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      mono
                    />
                  )}
                </Field>
                <Field label={t.checkout.cvc} error={errors.cvc}>
                  {(id, describedBy, invalid) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={cvc}
                      onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      mono
                    />
                  )}
                </Field>
              </div>

              <Button type="submit" variant="primary" size="lg" block loading={pay.isPending} icon={<Lock aria-hidden />}>
                {pay.isPending ? t.checkout.processing : t.checkout.pay(amount)}
              </Button>
              <p className={s.secure}>{t.checkout.secure}</p>
            </form>
          )}
        </Card>

        <aside className={s.aside}>
          <Card>
            <p className={s.summaryTitle}>{t.checkout.summary}</p>
            <div className={s.summaryCourse}>
              <CourseCover trail={course.trail} seed={course.id} height={64} className={s.summaryCover} />
              <div>
                <p className={s.summaryName}>{course.title}</p>
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {course.teacherName}, {t.common.lessons(lessons.length)}
                </p>
              </div>
            </div>
            <div className={s.total}>
              <span>{t.checkout.total}</span>
              <strong>{amount}</strong>
            </div>
            <p className={s.access}>{t.checkout.access}</p>
          </Card>

          <div className={s.sandbox}>
            <p className={s.sandboxTitle}>
              <FlaskConical aria-hidden />
              {t.checkout.sandboxTitle}
            </p>
            <p className={s.sandboxText}>{t.checkout.sandboxText}</p>
            <ul className={s.testCards}>
              {testCards.map((card) => (
                <li key={card.number}>
                  <button
                    type="button"
                    className={s.testCard}
                    disabled={owned}
                    onClick={() => {
                      setNumber(card.number)
                      if (!holder) setHolder('Sofia Tkachenko')
                      if (!expiry) setExpiry('12/30')
                      if (!cvc) setCvc('123')
                      setErrors({})
                    }}
                  >
                    <span className={s.testNumber}>{card.number}</span>
                    <span className={s.testKind} data-kind={card.kind}>
                      {t.checkout.cards[card.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
