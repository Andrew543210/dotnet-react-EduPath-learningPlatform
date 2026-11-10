import { Users } from 'lucide-react'
import { Link } from 'react-router'
import type { CourseCard, CourseStatus } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Badge, displayStyles as d, Stars, TrailDot, type Tone } from '@/ui/display'

const statusTones: Record<CourseStatus, Tone> = {
  Draft: 'neutral',
  PendingReview: 'warning',
  Published: 'success',
  Rejected: 'danger',
  Archived: 'neutral',
}

export function CourseTable({ courses }: { courses: CourseCard[] }) {
  const { t, f } = useI18n()
  return (
    <div className={d.tableWrap}>
      <table className={d.table}>
        <thead>
          <tr>
            <th>{t.teach.columns.course}</th>
            <th>{t.teach.columns.status}</th>
            <th className={d.numeric}>{t.teach.columns.students}</th>
            <th>{t.teach.columns.rating}</th>
            <th>{t.teach.columns.updated}</th>
            <th aria-label={t.common.actions} />
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.id}>
              <td style={{ minWidth: 240 }}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <TrailDot trail={c.trail} />
                  <Link to={`/teach/courses/${c.id}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                    {c.title}
                  </Link>
                </span>
                <span className="subtle" style={{ fontSize: 'var(--text-xs)', marginLeft: 19 }}>
                  {t.common.lessons(c.lessonCount)}, {c.price === 0 ? t.common.free : f.money(c.price)}
                </span>
              </td>
              <td>
                <Badge tone={statusTones[c.status]}>{t.courseStatus[c.status]}</Badge>
              </td>
              <td className={d.numeric}>{f.number(c.studentCount)}</td>
              <td>
                <Stars value={c.rating} count={c.reviewCount} compact />
              </td>
              <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                {f.relative(c.updatedAt)}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <ButtonLink to={`/teach/courses/${c.id}/students`} size="sm" variant="ghost" icon={<Users aria-hidden />}>
                  {t.teach.students}
                </ButtonLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

