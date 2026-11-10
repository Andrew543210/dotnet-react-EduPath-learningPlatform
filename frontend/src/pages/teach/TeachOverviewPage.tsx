import { useQuery } from '@tanstack/react-query'
import { Award, BookOpenCheck, ClipboardCheck, Plus, Star, Users, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import type { CourseCard, TeacherOverview } from '@/api/types'
import { WeeklyChart } from '@/features/charts/Charts'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Card, CardHeader, ErrorState, Loader, PageHeader, StatGrid, StatTile } from '@/ui/display'
import { CourseTable } from '@/features/teaching/CourseTable'
import s from './Teach.module.css'

export default function TeachOverviewPage() {
  const { t, f } = useI18n()
  const overview = useQuery({ queryKey: ['teach', 'overview'], queryFn: () => api.get<TeacherOverview>('/teach/overview') })
  const courses = useQuery({ queryKey: ['teach', 'courses'], queryFn: () => api.get<CourseCard[]>('/teach/courses') })

  if (overview.isPending) return <Loader />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  const o = overview.data

  return (
    <div className={s.stack}>
      <PageHeader
        title={t.teach.overviewTitle}
        subtitle={t.teach.overviewSubtitle}
        actions={
          <ButtonLink to="/teach/courses/new" variant="primary" icon={<Plus aria-hidden />}>
            {t.teach.newCourse}
          </ButtonLink>
        }
      />

      <StatGrid>
        <StatTile icon={Users} label={t.teach.statStudents} value={f.number(o.studentCount)} />
        <StatTile icon={Award} label={t.teach.statCompleted} value={f.number(o.completedCount)} />
        <StatTile icon={ClipboardCheck} label={t.teach.statScore} value={o.averageScore === null ? '—' : `${Math.round(o.averageScore)}%`} />
        <StatTile icon={Star} label={t.teach.statRating} value={f.rating(o.averageRating)} />
        <StatTile icon={Wallet} label={t.teach.statRevenue} value={f.money(o.revenue)} />
        <StatTile icon={BookOpenCheck} label={t.teach.statCourses} value={`${o.publishedCount} / ${o.courseCount}`} />
      </StatGrid>

      <Card>
        <CardHeader title={t.teach.enrollmentsChart} hint={t.teach.enrollmentsChartHint} />
        <WeeklyChart points={o.enrollmentsByWeek} format={(v) => f.number(v)} label={t.teach.enrollmentsChart} />
      </Card>

      {courses.data && courses.data.length > 0 && (
        <Card padded={false}>
          <div className={s.cardHead}>
            <CardHeader title={t.teach.courses} action={<ButtonLink to="/teach/courses" size="sm" variant="ghost">{t.common.viewAll}</ButtonLink>} />
          </div>
          <CourseTable courses={courses.data.slice(0, 5)} />
        </Card>
      )}
    </div>
  )
}
