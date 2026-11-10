import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock, Download, FileText, PlayCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '@/api/client'
import type { Lesson, LessonProgress } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink } from '@/ui/controls'
import { Badge, Callout, ErrorState, Loader, ProgressBar } from '@/ui/display'
import { Markdown } from '@/ui/Markdown'
import { useToast } from '@/ui/overlay'
import s from './LessonPage.module.css'

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function Outline({ lesson }: { lesson: Lesson }) {
  const { t } = useI18n()
  return (
    <aside className={s.outline}>
      <Link to={`/courses/${lesson.courseId}`} className={s.courseLink}>
        <ArrowLeft aria-hidden />
        {lesson.courseTitle}
      </Link>
      {!lesson.isPreview && <ProgressBar value={lesson.courseProgress} label={t.lesson.outline} showValue thin />}
      <ol className={s.stops}>
        {lesson.route.map((stop, i) => (
          <li key={stop.id}>
            <Link
              to={`/learn/lessons/${stop.id}`}
              className={clsx(s.stop, stop.id === lesson.id && s.stopCurrent, stop.isCompleted && s.stopDone)}
              aria-current={stop.id === lesson.id ? 'page' : undefined}
            >
              <span className={s.stopMark}>{stop.isCompleted ? <Check aria-hidden /> : i + 1}</span>
              <span className={s.stopTitle}>{stop.title}</span>
              {stop.hasTest && <ClipboardCheck className={s.stopTest} aria-label={t.course.hasTest} />}
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default function LessonPage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['lesson', id], queryFn: () => api.get<Lesson>(`/lessons/${id}`) })

  const complete = useMutation({
    mutationFn: () => api.post<LessonProgress>(`/lessons/${id}/complete`),
    onSuccess: (progress) => {
      queryClient.invalidateQueries({ queryKey: ['lesson'] })
      queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      if (progress.courseCompleted) {
        toast.success(t.lesson.courseDone)
        if (progress.certificateId) navigate(`/certificates/${progress.certificateId}`)
      } else {
        toast.success(t.lesson.completedToast(progress.courseProgress))
        if (progress.nextLessonId) navigate(`/learn/lessons/${progress.nextLessonId}`)
      }
    },
    onError: toast.error,
  })

  if (query.isPending) return <Loader />
  if (query.isError)
    return (
      <div className="container" style={{ paddingBlock: 48 }}>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    )

  const lesson = query.data
  const total = lesson.route.length
  const index = lesson.route.findIndex((r) => r.id === lesson.id)
  const hasTests = lesson.tests.length > 0

  return (
    <div className={`container ${s.layout}`}>
      <Outline lesson={lesson} />

      <article className={s.main}>
        {lesson.isPreview && <Callout tone="warning">{t.lesson.preview}</Callout>}

        <header className={s.head}>
          <p className={s.position}>{t.lesson.lessonOf(index + 1, total)}</p>
          <h1 className={s.title}>{lesson.title}</h1>
          <div className={s.meta}>
            <span>
              <Clock aria-hidden />
              {t.common.duration(lesson.durationMinutes)}
            </span>
            {lesson.isCompleted && (
              <Badge tone="success" icon={<Check aria-hidden />}>
                {t.lesson.completedBadge}
              </Badge>
            )}
          </div>
        </header>

        {lesson.videoUrl && (
          <a className={s.attachment} href={lesson.videoUrl} target="_blank" rel="noreferrer">
            <PlayCircle aria-hidden />
            <span>
              <strong>{t.lesson.video}</strong>
              <span className={s.attachmentMeta}>{hostOf(lesson.videoUrl)}</span>
            </span>
          </a>
        )}

        <Markdown>{lesson.content}</Markdown>

        {lesson.materialUrl && (
          <a className={s.attachment} href={lesson.materialUrl} download={lesson.materialName ?? true}>
            <FileText aria-hidden />
            <span>
              <strong>{lesson.materialName}</strong>
              <span className={s.attachmentMeta}>{t.lesson.material}</span>
            </span>
            <Download className={s.attachmentAction} aria-label={t.lesson.download} />
          </a>
        )}

        {hasTests && (
          <section className={s.tests}>
            <h2 className={s.testsTitle}>{t.lesson.testsTitle}</h2>
            {!lesson.isPreview && <p className={s.testsHint}>{t.lesson.testsHint}</p>}
            {lesson.tests.map((test) => (
              <div key={test.id} className={clsx(s.test, test.passed && s.testPassed)}>
                <div className={s.testInfo}>
                  <span className={s.testName}>
                    {test.title}
                    {test.passed && (
                      <Badge tone="success" icon={<Check aria-hidden />}>
                        {t.lesson.passedBadge}
                      </Badge>
                    )}
                  </span>
                  <span className={s.testMeta}>
                    {t.lesson.questions(test.questionCount)}, {t.lesson.threshold(test.passingScore)}
                    {test.attempts > 0 && `, ${t.lesson.attempts(test.attempts)}`}
                    {test.bestScore !== null && `, ${t.lesson.best(test.bestScore)}`}
                  </span>
                </div>
                <ButtonLink to={`/learn/tests/${test.id}`} variant={test.passed || lesson.isPreview ? 'secondary' : 'primary'}>
                  {lesson.isPreview ? t.lesson.previewTest : test.attempts > 0 ? t.lesson.retryTest : t.lesson.startTest}
                </ButtonLink>
              </div>
            ))}
          </section>
        )}

        <footer className={s.foot}>
          {lesson.prevLessonId ? (
            <ButtonLink to={`/learn/lessons/${lesson.prevLessonId}`} variant="ghost" icon={<ArrowLeft aria-hidden />}>
              {t.lesson.prev}
            </ButtonLink>
          ) : (
            <span />
          )}
          <div className={s.footRight}>
            {!lesson.isPreview && !lesson.isCompleted && !hasTests && (
              <Button variant="primary" loading={complete.isPending} onClick={() => complete.mutate()} icon={<Check aria-hidden />}>
                {t.lesson.markComplete}
              </Button>
            )}
            {lesson.nextLessonId && (lesson.isCompleted || lesson.isPreview || hasTests) && (
              <ButtonLink to={`/learn/lessons/${lesson.nextLessonId}`} variant={lesson.isCompleted ? 'primary' : 'secondary'}>
                {t.lesson.next}
                <ArrowRight aria-hidden />
              </ButtonLink>
            )}
          </div>
        </footer>
      </article>
    </div>
  )
}
