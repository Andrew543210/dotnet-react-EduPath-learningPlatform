import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { Certificate } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Card, CourseCover, EmptyState, ErrorState, Loader, PageHeader } from '@/ui/display'
import s from './Certificate.module.css'

export default function CertificatesPage() {
  const { t, f } = useI18n()
  const query = useQuery({ queryKey: ['certificates'], queryFn: () => api.get<Certificate[]>('/certificates') })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <>
      <PageHeader title={t.certificates.title} subtitle={t.certificates.subtitle} />
      {query.data.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title={t.certificates.empty} action={<ButtonLink to="/learn">{t.nav.myLearning}</ButtonLink>} />
        </Card>
      ) : (
        <div className={s.grid}>
          {query.data.map((c) => (
            <article key={c.id} className={s.item}>
              <CourseCover trail={c.trail} seed={c.courseId} height={84} />
              <div className={s.itemBody}>
                <h2 className={s.itemTitle}>
                  <Link to={`/certificates/${c.id}`}>{c.courseTitle}</Link>
                </h2>
                <p className={s.itemMeta}>
                  {f.date(c.issueDate)}
                  {c.finalScore !== null && `, ${t.certificates.finalScore.toLowerCase()} ${c.finalScore}%`}
                </p>
                <p className={s.itemNumber}>{c.number}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
