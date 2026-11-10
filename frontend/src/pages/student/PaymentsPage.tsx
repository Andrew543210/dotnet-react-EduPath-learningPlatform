import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { Payment, PaymentStatus } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Badge, Card, displayStyles as d, EmptyState, ErrorState, Loader, PageHeader, type Tone } from '@/ui/display'

const tones: Record<PaymentStatus, Tone> = { Succeeded: 'success', Failed: 'danger', Pending: 'warning' }

export default function PaymentsPage() {
  const { t, f } = useI18n()
  const query = useQuery({ queryKey: ['payments'], queryFn: () => api.get<Payment[]>('/payments') })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <>
      <PageHeader title={t.payments.title} subtitle={t.payments.subtitle} />
      {query.data.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title={t.payments.empty} action={<ButtonLink to="/catalog?price=Paid">{t.nav.toCatalog}</ButtonLink>} />
        </Card>
      ) : (
        <Card padded={false}>
          <div className={d.tableWrap}>
            <table className={d.table}>
              <thead>
                <tr>
                  <th>{t.payments.date}</th>
                  <th>{t.payments.course}</th>
                  <th>{t.payments.card}</th>
                  <th>{t.payments.status}</th>
                  <th className={d.numeric}>{t.payments.amount}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link to={`/payments/${p.id}`}>{f.dateTime(p.paymentDate)}</Link>
                    </td>
                    <td>{p.courseTitle}</td>
                    <td className="tabular">{p.cardLast4 ? `•••• ${p.cardLast4}` : '—'}</td>
                    <td>
                      <Badge tone={tones[p.status]}>{t.paymentStatus[p.status]}</Badge>
                    </td>
                    <td className={d.numeric}>{f.money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
