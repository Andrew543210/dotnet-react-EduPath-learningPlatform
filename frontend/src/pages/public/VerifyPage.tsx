import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '@/api/client'
import type { Certificate } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Input } from '@/ui/controls'
import { Card, Loader, PageHeader } from '@/ui/display'
import s from './AuthPages.module.css'

export default function VerifyPage() {
  const { number = '' } = useParams()
  const { t, f } = useI18n()
  const navigate = useNavigate()
  const [value, setValue] = useState(number)
  useEffect(() => setValue(number), [number])

  const query = useQuery({
    queryKey: ['verify', number],
    queryFn: () => api.get<Certificate>(`/certificates/verify/${encodeURIComponent(number)}`),
    enabled: Boolean(number),
    retry: false,
  })

  return (
    <div className={s.verify}>
      <PageHeader title={t.certificates.verifyTitle} subtitle={t.certificates.verifySubtitle} />
      <form
        className={s.verifyForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) navigate(`/verify/${encodeURIComponent(value.trim().toUpperCase())}`)
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.certificates.verifyPlaceholder}
          aria-label={t.certificates.verifyPlaceholder}
          mono
        />
        <Button type="submit" variant="primary">
          {t.certificates.verifySubmit}
        </Button>
      </form>

      {number && query.isPending && <Loader />}
      {query.isSuccess && (
        <Card className={s.verifyResult}>
          <span className={`${s.verifyIcon} ${s.verifyOk}`}>
            <BadgeCheck aria-hidden />
          </span>
          <div>
            <h2 className={s.sectionTitle} style={{ marginBottom: 4 }}>
              {t.certificates.valid}
            </h2>
            <p className="muted">{t.certificates.validText(query.data.studentName, query.data.courseTitle)}</p>
            <dl className={s.verifyDetails}>
              <dt>{t.certificates.number}</dt>
              <dd className="tabular">{query.data.number}</dd>
              <dt>{t.certificates.issued}</dt>
              <dd>{f.date(query.data.issueDate)}</dd>
              <dt>{t.certificates.teacher}</dt>
              <dd>{query.data.teacherName}</dd>
              {query.data.finalScore !== null && (
                <>
                  <dt>{t.certificates.finalScore}</dt>
                  <dd>{query.data.finalScore}%</dd>
                </>
              )}
            </dl>
          </div>
        </Card>
      )}
      {query.isError && (
        <Card className={s.verifyResult}>
          <span className={`${s.verifyIcon} ${s.verifyBad}`}>
            <SearchX aria-hidden />
          </span>
          <div>
            <h2 className={s.sectionTitle} style={{ marginBottom: 4 }}>
              {t.certificates.invalid}
            </h2>
            <p className="muted">{t.certificates.invalidText}</p>
          </div>
        </Card>
      )}
    </div>
  )
}
