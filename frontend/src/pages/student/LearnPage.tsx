import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { MyCourse, ResultSummary } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { RouteTrack } from '@/features/learning/RouteTrack'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Badge, Card, CardHeader, CourseCover, EmptyState, ErrorState, Loader, PageHeader } from '@/ui/display'
import s from './Student.module.css'

function ContinueCard({ course }: { course: MyCourse }) {
  const { t } = useI18n()
  return (
    <Card className={s.continue}>
      <CourseCover trail={course.trail} seed={course.courseId} height={150} className={s.continueCover} />
      <div className={s.continueBody}>
        <p className={s.eyebrowless}>{t.learn.continueTitle}</p>
        <h2 className={s.continueTitle}>
          <Link to={`/courses/${course.courseId}`}>{course.title}</Link>
        </h2>
        <div className={s.continueRoute}>
          <RouteTrack stops={course.route} currentId={course.nextLessonId} label={t.lesson.outline} />
          <span className={s.percent}>{course.progress}%</span>
        </div>
        {course.nextLessonId && (
          <div className={s.nextRow}>
            <div>
              <span className={s.nextLabel}>{t.learn.nextLesson}</span>
              <span className={s.nextTitle}>{course.nextLessonTitle}</span>
            </div>
            <ButtonLink to={`/learn/lessons/${course.nextLessonId}`} variant="primary">
              {t.learn.goToLesson}
            </ButtonLink>
          </div>
        )}
      </div>
    </Card>
  )
}

function CourseRow({ course }: { course: MyCourse }) {
  const { t, f } = useI18n()
  const done = course.status === 'Completed'
  return (
    <li className={s.row}>
      <div className={s.rowMain}>
        <Link to={`/courses/${course.courseId}`} className={s.rowTitle}>
          {course.title}
        </Link>
        <span className={s.rowMeta}>
          {course.teacherName}
          {course.lastActivityAt && `, ${f.relative(course.lastActivityAt)}`}
        </span>
      </div>
      <div className={s.rowRoute}>
        <RouteTrack stops={course.route} currentId={course.nextLessonId} label={course.title} />
        <span className={s.percent}>{course.progress}%</span>
      </div>
      <div className={s.rowAction}>
        {done && course.certificateId ? (
          <ButtonLink to={`/certificates/${course.certificateId}`} size="sm" variant="soft" icon={<Award aria-hidden />}>
            {t.learn.certificateReady}
          </ButtonLink>
        ) : course.nextLessonId ? (
          <ButtonLink to={`/learn/lessons/${course.nextLessonId}`} size="sm">
            {t.learn.goToLesson}
          </ButtonLink>
        ) : null}
      </div>
    </li>
  )
}

export default function LearnPage() {
  const { t, f } = useI18n()
  const { user } = useAuth()
  const courses = useQuery({ queryKey: ['my-courses'], queryFn: () => api.get<MyCourse[]>('/me/courses') })
  const results = useQuery({ queryKey: ['my-results'], queryFn: () => api.get<ResultSummary[]>('/me/results', { take: 6 }) })

  if (courses.isPending) return <Loader />
  if (courses.isError) return <ErrorState error={courses.error} onRetry={() => courses.refetch()} />

  const active = courses.data.filter((c) => c.status !== 'Completed')
  const completed = courses.data.filter((c) => c.status === 'Completed')
  const recent = [...active].sort((a, b) => (b.lastActivityAt ?? b.enrolledAt).localeCompare(a.lastActivityAt ?? a.enrolledAt))[0]

  return (
    <>
      <PageHeader
        title={t.learn.greeting(user?.name ?? '')}
        subtitle={t.learn.subtitle}
        actions={<ButtonLink to="/catalog">{t.nav.catalog}</ButtonLink>}
      />

      {courses.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={t.learn.emptyTitle}
            text={t.learn.emptyText}
            action={
              <ButtonLink to="/catalog?price=Free" variant="primary">
                {t.learn.emptyCta}
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className={s.dashboard}>
          <div className={s.dashMain}>
            {recent && <ContinueCard course={recent} />}

            {active.length > 0 && (
              <Card>
                <CardHeader title={t.learn.inProgress} hint={t.common.courses(active.length)} />
                <ul className={s.rows}>
                  {active.map((c) => (
                    <CourseRow key={c.courseId} course={c} />
                  ))}
                </ul>
              </Card>
            )}

            {completed.length > 0 && (
              <Card>
                <CardHeader title={t.learn.completed} hint={t.common.courses(completed.length)} />
                <ul className={s.rows}>
                  {completed.map((c) => (
                    <CourseRow key={c.courseId} course={c} />
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <aside className={s.dashAside}>
            <Card>
              <CardHeader title={t.learn.results} />
              {results.data?.length ? (
                <ul className={s.results}>
                  {results.data.map((r) => (
                    <li key={r.id}>
                      <Link to={`/learn/results/${r.id}`} className={s.result}>
                        {r.passed ? <CheckCircle2 className={s.ok} aria-hidden /> : <XCircle className={s.bad} aria-hidden />}
                        <span className={s.resultText}>
                          <span className={s.resultTitle}>{r.testTitle}</span>
                          <span className={s.resultMeta}>
                            {r.courseTitle}, {f.relative(r.completedAt)}
                          </span>
                        </span>
                        <Badge tone={r.passed ? 'success' : 'danger'}>{r.score}%</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t.learn.noResults}</p>
              )}
            </Card>
            {completed.some((c) => c.certificateId) && (
              <ButtonLink to="/certificates" icon={<Award aria-hidden />} block>
                {t.learn.allCertificates}
              </ButtonLink>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
