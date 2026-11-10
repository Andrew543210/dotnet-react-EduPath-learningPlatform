import { useQuery } from '@tanstack/react-query'
import { Copy, Download, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useParams } from 'react-router'
import { api } from '@/api/client'
import type { Certificate } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink } from '@/ui/controls'
import { ErrorState, Loader, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import s from './Certificate.module.css'

export default function CertificatePage() {
  const id = Number(useParams().id)
  const { t, f } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const query = useQuery({ queryKey: ['certificates', id], queryFn: () => api.get<Certificate>(`/certificates/${id}`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const c = query.data
  const verifyUrl = `${window.location.origin}/verify/${c.number}`

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={user?.role === 'Student' ? { to: '/certificates', label: t.certificates.title } : undefined}
          title={c.courseTitle}
          actions={
            <>
              <Button icon={<Printer aria-hidden />} onClick={() => window.print()}>
                {t.certificates.print}
              </Button>
              {c.fileUrl && (
                <ButtonLink to={c.fileUrl} external icon={<Download aria-hidden />}>
                  {t.certificates.download}
                </ButtonLink>
              )}
              <Button
                variant="ghost"
                icon={<Copy aria-hidden />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(verifyUrl)
                    toast.success(t.common.copied)
                  } catch {
                    toast.info(verifyUrl)
                  }
                }}
              >
                {t.certificates.copyLink}
              </Button>
            </>
          }
        />
      </div>

      <article className={s.sheet} aria-label={t.certificates.heading}>
        <div className={s.sheetInner}>
          <header className={s.sheetHead}>
            <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#116d63" />
              <path d="M8 23h5v-5h5v-5h6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="24" cy="9" r="3" fill="#f2a93b" />
            </svg>
            <span className={s.brand}>EduPath</span>
          </header>

          <p className={s.kicker}>{t.certificates.heading}</p>
          <p className={s.lead}>{t.certificates.certifies}</p>
          <p className={s.student}>{c.studentName}</p>
          <p className={s.lead}>{t.certificates.completedCourse}</p>
          <p className={s.course}>«{c.courseTitle}»</p>
          <p className={s.scope}>{t.certificates.scope(c.lessonCount, t.common.duration(c.durationMinutes))}</p>

          <footer className={s.sheetFoot}>
            <dl className={s.facts}>
              <div>
                <dt>{t.certificates.issued}</dt>
                <dd>{f.date(c.issueDate)}</dd>
              </div>
              <div>
                <dt>{t.certificates.teacher}</dt>
                <dd>{c.teacherName}</dd>
              </div>
              {c.finalScore !== null && (
                <div>
                  <dt>{t.certificates.finalScore}</dt>
                  <dd>{c.finalScore}%</dd>
                </div>
              )}
              <div>
                <dt>{t.certificates.number}</dt>
                <dd className={s.number}>{c.number}</dd>
              </div>
            </dl>
            <div className={s.qr}>
              <QRCodeSVG value={verifyUrl} size={104} bgColor="#ffffff" fgColor="#16201e" level="M" />
              <span>{t.certificates.scanToVerify}</span>
            </div>
          </footer>
        </div>
      </article>
    </>
  )
}
