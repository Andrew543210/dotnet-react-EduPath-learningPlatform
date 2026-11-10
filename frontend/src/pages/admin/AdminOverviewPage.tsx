import { useQuery } from '@tanstack/react-query'
import { Award, BookOpenCheck, GraduationCap, ShieldCheck, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { AdminOverview, ModerationItem } from '@/api/types'
import { WeeklyChart } from '@/features/charts/Charts'
import { useI18n } from '@/i18n/I18nProvider'
import s from '@/pages/teach/Teach.module.css'
import { ButtonLink } from '@/ui/controls'
import { Card, CardHeader, ErrorState, Loader, PageHeader, StatGrid, StatTile, TrailDot } from '@/ui/display'
import a from './Admin.module.css'

export default function AdminOverviewPage() {
  const { t, f } = useI18n()
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<AdminOverview>('/admin/overview') })
  const pending = useQuery({
    queryKey: ['admin', 'moderation', 'PendingReview'],
    queryFn: () => api.get<ModerationItem[]>('/admin/moderation', { status: 'PendingReview' }),
  })

  if (overview.isPending) return <Loader />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  const o = overview.data

  return (
    <div className={s.stack}>
      <PageHeader title={t.admin.overviewTitle} subtitle={t.admin.overviewSubtitle} />

      <StatGrid>
        <StatTile icon={Users} label={t.admin.statUsers} value={f.number(o.students + o.teachers + o.admins)} hint={t.admin.statUsersHint(o.students, o.teachers, o.admins)} />
        <StatTile icon={BookOpenCheck} label={t.admin.statCourses} value={f.number(o.publishedCourses)} hint={t.admin.statCoursesHint(o.pendingCourses, o.draftCourses)} />
        <StatTile icon={GraduationCap} label={t.admin.statEnrollments} value={f.number(o.activeEnrollments)} hint={t.admin.statEnrollmentsHint(o.completedEnrollments)} />
        <StatTile icon={Wallet} label={t.admin.statRevenue} value={f.money(o.revenue)} hint={t.admin.statRevenueHint(o.successfulPayments, o.failedPayments)} />
        <StatTile icon={Award} label={t.admin.statCertificates} value={f.number(o.certificates)} />
      </StatGrid>

      <div className={a.charts}>
        <Card>
          <CardHeader title={t.admin.revenueChart} />
          <WeeklyChart points={o.revenueByWeek} format={(v) => f.money(v)} label={t.admin.revenueChart} />
        </Card>
        <Card>
          <CardHeader title={t.admin.signupsChart} />
          <WeeklyChart points={o.signupsByWeek} format={(v) => f.number(v)} label={t.admin.signupsChart} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t.admin.pendingTitle}
          action={
            <ButtonLink to="/admin/moderation" size="sm" variant="ghost" icon={<ShieldCheck aria-hidden />}>
              {t.admin.moderation}
            </ButtonLink>
          }
        />
        {pending.data?.length ? (
          <ul className={a.list}>
            {pending.data.map((item) => (
              <li key={item.course.id}>
                <TrailDot trail={item.course.trail} />
                <Link to={`/courses/${item.course.id}`}>{item.course.title}</Link>
                <span className="muted">
                  {item.course.teacherName}, {f.relative(item.course.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.admin.pendingEmpty}</p>
        )}
      </Card>
    </div>
  )
}
