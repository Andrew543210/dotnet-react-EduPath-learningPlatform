import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Award, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useParams } from 'react-router'
import { api } from '@/api/client'
import type { TestResult } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { Callout, Card, ErrorState, Loader, PageHeader } from '@/ui/display'
import s from './TestPage.module.css'

function ScoreGauge({ score, threshold, passed }: { score: number; threshold: number; passed: boolean }) {
  const { t } = useI18n()
  const r = 56
  const c = 2 * Math.PI * r
  const angle = (threshold / 100) * 2 * Math.PI
  return (
    <div className={s.gauge}>
      <svg viewBox="0 0 132 132" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" strokeWidth="10" className={s.gaugeTrack} />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={clsx(s.gaugeValue, !passed && s.gaugeFailed)}
        />
        <line
          x1={66 + (r - 8) * Math.cos(angle)}
          y1={66 + (r - 8) * Math.sin(angle)}
          x2={66 + (r + 8) * Math.cos(angle)}
          y2={66 + (r + 8) * Math.sin(angle)}
          strokeWidth="2"
          className={s.gaugeThreshold}
        />
      </svg>
      <div className={s.gaugeLabel}>
        <span className={s.gaugeNumber}>{score}%</span>
        <span className={s.gaugeCaption}>{t.lesson.threshold(threshold)}</span>
      </div>
    </div>
  )
}

export default function ResultPage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['result', id], queryFn: () => api.get<TestResult>(`/results/${id}`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const r = query.data
  const courseDone = r.nextState === 'CourseCompleted' || r.nextState === 'CertificateGenerated' || r.nextState === 'Finished'

  return (
    <div className={s.page}>
      <PageHeader back={{ to: `/learn/lessons/${r.lessonId}`, label: t.test.backToLesson }} title={r.testTitle} subtitle={r.courseTitle} />

      <Card className={s.score}>
        <ScoreGauge score={r.score} threshold={r.passingScore} passed={r.passed} />
        <div className={s.scoreText}>
          <h2 className={s.scoreTitle} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {r.passed ? (
              <CheckCircle2 color="var(--success)" aria-hidden />
            ) : (
              <XCircle color="var(--danger)" aria-hidden />
            )}
            {r.passed ? t.test.passedTitle : t.test.failedTitle}
          </h2>
          <p className="muted">
            {t.test.correct(r.correctCount, r.totalCount)}. {t.test.attempt(r.attemptNumber)}.
          </p>
          <p>{r.passed ? (courseDone ? t.test.courseCompleted : t.test.passedText) : t.test.failedText(r.passingScore)}</p>
          <div className={s.scoreActions}>
            {r.passed && r.certificateId && (
              <ButtonLink to={`/certificates/${r.certificateId}`} variant="primary" icon={<Award aria-hidden />}>
                {t.test.certificate}
              </ButtonLink>
            )}
            {r.passed && !r.certificateId && r.nextLessonId && (
              <ButtonLink to={`/learn/lessons/${r.nextLessonId}`} variant="primary">
                {t.test.nextLesson}
              </ButtonLink>
            )}
            {!r.passed && (
              <ButtonLink to={`/learn/tests/${r.testId}`} variant="primary" icon={<RotateCcw aria-hidden />}>
                {t.test.retry}
              </ButtonLink>
            )}
            <ButtonLink to={`/learn/lessons/${r.lessonId}`}>{t.test.backToLesson}</ButtonLink>
          </div>
        </div>
      </Card>

      <section className={s.stack}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>{t.test.review}</h2>
        {!r.passed && <Callout>{t.test.hiddenUntilPassed}</Callout>}
        <ol className={s.review}>
          {r.answers.map((a) => (
            <li key={a.questionId} className={clsx(s.reviewItem, !a.isCorrect && s.reviewWrong)}>
              <p className={s.reviewQuestion}>
                {a.isCorrect ? <CheckCircle2 color="var(--success)" aria-label="✓" /> : <XCircle color="var(--danger)" aria-label="✗" />}
                {a.question}
              </p>
              <dl>
                <div className={s.reviewLine}>
                  <dt>{t.test.yourAnswer}</dt>
                  <dd>{a.selectedAnswer || <span className="subtle">{t.test.noAnswer}</span>}</dd>
                </div>
                {a.correctAnswer && !a.isCorrect && (
                  <div className={s.reviewLine}>
                    <dt>{t.test.correctAnswer}</dt>
                    <dd>{a.correctAnswer}</dd>
                  </div>
                )}
              </dl>
              {a.explanation && <p className={s.explanation}>{a.explanation}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
