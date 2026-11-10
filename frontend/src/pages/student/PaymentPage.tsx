import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useParams } from 'react-router'
import { api } from '@/api/client'
import type { Payment } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Card, ErrorState, Loader } from '@/ui/display'
import s from './Checkout.module.css'

export default function PaymentPage() {
  const id = Number(useParams().id)
  const { t, f } = useI18n()
  const query = useQuery({ queryKey: ['payment', id], queryFn: () => api.get<Payment>(`/payments/${id}`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const p = query.data
  const ok = p.status === 'Succeeded'

  return (
    <Card className={s.outcome}>
      <span className={`${s.outcomeIcon} ${ok ? s.outcomeOk : s.outcomeBad}`}>{ok ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}</span>
      <h1 style={{ fontSize: 'var(--text-xl)' }}>{ok ? t.checkout.successTitle : t.checkout.failedTitle}</h1>
      <p className="muted">{ok ? t.checkout.successText(p.courseTitle) : t.checkout.failedText(p.failureReason ?? '—')}</p>

      <dl className={s.receipt}>
        <dt>{t.payments.course}</dt>
        <dd>{p.courseTitle}</dd>
        <dt>{t.payments.amount}</dt>
        <dd>{f.money(p.amount)}</dd>
        <dt>{t.payments.date}</dt>
        <dd>{f.dateTime(p.paymentDate)}</dd>
        {p.cardLast4 && (
          <>
            <dt>{t.checkout.card}</dt>
            <dd className="tabular">•••• {p.cardLast4}</dd>
          </>
        )}
        {p.transactionId && (
          <>
            <dt>{t.checkout.transaction}</dt>
            <dd className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              {p.transactionId}
            </dd>
          </>
        )}
      </dl>

      <div className={s.outcomeActions}>
        {ok && p.firstLessonId ? (
          <ButtonLink to={`/learn/lessons/${p.firstLessonId}`} variant="primary">
            {t.checkout.goToLesson}
          </ButtonLink>
        ) : (
          !ok && (
            <ButtonLink to={`/courses/${p.courseId}/checkout`} variant="primary">
              {t.test.retry}
            </ButtonLink>
          )
        )}
        <ButtonLink to="/payments">{t.payments.title}</ButtonLink>
      </div>
    </Card>
  )
}
