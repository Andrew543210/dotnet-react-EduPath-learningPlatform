import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, BookOpen, CheckCircle2, CircleCheck, ClipboardCheck, Clock, Infinity as InfinityIcon, Lock, PencilLine, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '@/api/client'
import type { CourseDetails, Enrollment } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { CourseReviews } from '@/features/reviews/CourseReviews'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink } from '@/ui/controls'
import { Avatar, Badge, Callout, Card, CourseCover, ErrorState, Loader, ProgressBar, Stars } from '@/ui/display'
import { Markdown } from '@/ui/Markdown'
import { useToast } from '@/ui/overlay'
import s from './CoursePage.module.css'

function PurchaseBox({ details }: { details: CourseDetails }) {
  const { t, f } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { course, learner } = details
  const firstLesson = details.lessons[0]?.id

  const enroll = useMutation({
    mutationFn: () => api.post<Enrollment>(`/courses/${course.id}/enroll`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['course', course.id] })
      queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      if (firstLesson) navigate(`/learn/lessons/${firstLesson}`)
    },
    onError: toast.error,
  })

  const isOwnerOrAdmin = user && (user.role === 'Admin' || (user.role === 'Teacher' && user.id === details.teacher.id))
  const status = learner?.enrollmentStatus
  const enrolled = status === 'Active' || status === 'Completed'

  let action: ReactNode
  if (!user) {
    action = (
      <>
        <ButtonLink to={`/login?next=/courses/${course.id}`} variant="primary" size="lg" block>
          {course.price === 0 ? t.course.enrollFree : t.course.buy(f.money(course.price))}
        </ButtonLink>
        <p className={s.boxNote}>{t.course.signInToEnroll}</p>
      </>
    )
  } else if (user.role !== 'Student') {
    action = (
      <>
        <Callout>{t.course.staffNote}</Callout>
        {isOwnerOrAdmin && (
          <ButtonLink to={`/teach/courses/${course.id}`} icon={<PencilLine aria-hidden />} block>
            {t.course.editCourse}
          </ButtonLink>
        )}
        {isOwnerOrAdmin && firstLesson && (
          <ButtonLink to={`/learn/lessons/${firstLesson}`} variant="soft" block>
            {t.course.openLessons}
          </ButtonLink>
        )}
      </>
    )
  } else if (status === 'Completed') {
    action = (
      <>
        <ProgressBar value={100} label={t.course.completed} showValue />
        {learner?.certificateId && (
          <ButtonLink to={`/certificates/${learner.certificateId}`} variant="primary" size="lg" block icon={<Award aria-hidden />}>
            {t.course.viewCertificate}
          </ButtonLink>
        )}
      </>
    )
  } else if (enrolled) {
    const next = learner?.nextLessonId ?? firstLesson
    action = (
      <>
        <ProgressBar value={learner?.progress ?? 0} label={t.course.enrolled} showValue />
        {next && (
          <ButtonLink to={`/learn/lessons/${next}`} variant="primary" size="lg" block>
            {(learner?.progress ?? 0) > 0 ? t.course.continue : t.course.start}
          </ButtonLink>
        )}
      </>
    )
  } else if (course.price === 0) {
    action = (
      <Button variant="primary" size="lg" block loading={enroll.isPending} onClick={() => enroll.mutate()}>
        {t.course.enrollFree}
      </Button>
    )
  } else {
    action = (
      <ButtonLink to={`/courses/${course.id}/checkout`} variant="primary" size="lg" block>
        {t.course.buy(f.money(course.price))}
      </ButtonLink>
    )
  }

  return (
    <Card className={s.box}>
      <p className={course.price === 0 ? s.priceFree : s.price}>{course.price === 0 ? t.common.free : f.money(course.price)}</p>
      <div className={s.boxActions}>{action}</div>
      <div className={s.includes}>
        <p className={s.includesTitle}>{t.course.includes}</p>
        <ul>
          <li>
            <BookOpen aria-hidden />
            {t.course.includesLessons(course.lessonCount)}, {t.common.duration(course.durationMinutes)}
          </li>
          {details.testCount > 0 && (
            <li>
              <ClipboardCheck aria-hidden />
              {t.course.includesTests(details.testCount)}
            </li>
          )}
          <li>
            <Award aria-hidden />
            {t.course.includesCertificate}
          </li>
          <li>
            <InfinityIcon aria-hidden />
            {t.course.includesAccess}
          </li>
        </ul>
      </div>
    </Card>
  )
}

export default function CoursePage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['course', id, user?.id ?? 0], queryFn: () => api.get<CourseDetails>(`/courses/${id}`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  const details = query.data
  const { course, learner } = details
  const status = learner?.enrollmentStatus
  const canOpenLessons = status === 'Active' || status === 'Completed' || details.isPreview || user?.role === 'Admin' || (user?.role === 'Teacher' && user.id === details.teacher.id)

  return (
    <div className={s.page}>
      {details.isPreview && (
        <div className={s.notice}>
          <Callout tone="warning" title={t.course.preview}>
            {details.moderationComment && (
              <p>
                {t.course.moderationNote}: {details.moderationComment}
              </p>
            )}
          </Callout>
        </div>
      )}
      {!details.isPreview && course.status === 'Archived' && (
        <div className={s.notice}>
          <Callout>{t.course.archived}</Callout>
        </div>
      )}

      <header className={s.head}>
        <CourseCover trail={course.trail} seed={course.id} height={180} className={s.cover} />
        <div className={s.headText}>
          <p className={s.crumbs}>
            <Link to={`/catalog?categoryId=${course.categoryId}`}>{course.categoryName}</Link>
            <span aria-hidden>/</span>
            <span>{t.levels[course.level]}</span>
          </p>
          <h1 className={s.title}>{course.title}</h1>
          <p className={s.summary}>{course.summary}</p>
          <div className={s.meta}>
            <Stars value={course.rating} count={course.reviewCount} />
            <span className={s.metaItem}>
              <Users aria-hidden />
              {t.common.students(course.studentCount)}
            </span>
            <span className={s.metaItem}>
              <Clock aria-hidden />
              {t.common.duration(course.durationMinutes)}
            </span>
          </div>
          <Link to={`/teachers/${details.teacher.id}`} className={s.teacherLink}>
            <Avatar name={details.teacher.name} size={30} />
            {details.teacher.name}
          </Link>
        </div>
      </header>

      <div className={s.layout}>
        <div className={s.content}>
          {details.outcomes.length > 0 && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>{t.course.outcomes}</h2>
              <ul className={s.outcomes}>
                {details.outcomes.map((o) => (
                  <li key={o}>
                    <CheckCircle2 aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={s.section}>
            <h2 className={s.sectionTitle}>{t.course.syllabus}</h2>
            <p className={s.sectionHint}>
              {t.common.lessons(details.lessons.length)}, {t.common.duration(course.durationMinutes)}
            </p>
            <ol className={s.syllabus}>
              {details.lessons.map((l) => {
                const inner = (
                  <>
                    <span className={s.lessonNumber} data-done={l.isCompleted || undefined}>
                      {l.isCompleted ? <CircleCheck aria-hidden /> : l.orderNumber}
                    </span>
                    <span className={s.lessonTitle}>{l.title}</span>
                    {l.hasTest && <Badge tone="accent">{t.course.hasTest}</Badge>}
                    <span className={s.lessonTime}>{t.common.duration(l.durationMinutes)}</span>
                    {!canOpenLessons && <Lock className={s.lock} aria-label={t.course.locked} />}
                  </>
                )
                return (
                  <li key={l.id}>
                    {canOpenLessons ? (
                      <Link to={`/learn/lessons/${l.id}`} className={s.lesson}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={s.lesson}>{inner}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>{t.course.about}</h2>
            <Markdown>{details.description}</Markdown>
          </section>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>{t.course.teacher}</h2>
            <Card className={s.teacher}>
              <Avatar name={details.teacher.name} size={56} />
              <div>
                <Link to={`/teachers/${details.teacher.id}`} className={s.teacherName}>
                  {details.teacher.name}
                </Link>
                {details.teacher.headline && <p className="muted">{details.teacher.headline}</p>}
                <p className={s.teacherStats}>{t.course.teacherStats(details.teacher.courseCount, details.teacher.studentCount)}</p>
                {details.teacher.bio && <p className={s.teacherBio}>{details.teacher.bio}</p>}
              </div>
            </Card>
          </section>

          {!details.isPreview && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>{t.course.reviews}</h2>
              <CourseReviews courseId={course.id} canReview={learner?.canReview ?? false} />
            </section>
          )}
        </div>

        <aside className={s.aside}>
          <PurchaseBox details={details} />
        </aside>
      </div>
    </div>
  )
}
