import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '@/api/client'
import type { TestResult, TestSession } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/ui/controls'
import { Callout, Card, ErrorState, Loader, PageHeader, ProgressBar } from '@/ui/display'
import { useConfirm, useToast } from '@/ui/overlay'
import s from './TestPage.module.css'

export default function TestPage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const query = useQuery({ queryKey: ['test', id], queryFn: () => api.get<TestSession>(`/tests/${id}`), staleTime: 0 })

  const submit = useMutation({
    mutationFn: () => api.post<TestResult>(`/tests/${id}/submit`, { answers }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lesson'] })
      queryClient.invalidateQueries({ queryKey: ['my-courses'] })
      queryClient.invalidateQueries({ queryKey: ['my-results'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      queryClient.setQueryData(['result', result.id], result)
      navigate(`/learn/results/${result.id}`, { replace: true })
    },
    onError: toast.error,
  })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  const test = query.data
  const preview = user?.role !== 'Student'
  const answered = test.questions.filter((q) => answers[q.id]).length
  const total = test.questions.length

  const onSubmit = async () => {
    const missing = total - answered
    if (missing > 0 && !(await confirm({ title: t.test.submit, text: t.test.unansweredConfirm(missing), confirmLabel: t.test.submit }))) return
    submit.mutate()
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ to: `/learn/lessons/${test.lessonId}`, label: t.test.backToLesson }}
        title={test.title}
        subtitle={`${test.courseTitle}. ${t.test.threshold(test.passingScore)}`}
      />

      {preview && <Callout tone="warning">{t.test.previewNote}</Callout>}

      <div className={s.status}>
        {!preview && <span className={s.attempt}>{t.test.attempt(test.attemptNumber)}</span>}
        <ProgressBar value={total ? (answered / total) * 100 : 0} label={t.test.answered(answered, total)} thin />
      </div>

      <ol className={s.questions}>
        {test.questions.map((q, qi) => (
          <li key={q.id}>
            <Card as="div" className={s.question}>
              <fieldset className={s.fieldset}>
                <legend className={s.questionText}>
                  <span className={s.questionNumber}>{qi + 1}</span>
                  {q.text}
                </legend>
                <div className={s.options}>
                  {q.options.map((option) => (
                    <label key={option} className={clsx(s.option, answers[q.id] === option && s.optionSelected)}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={option}
                        checked={answers[q.id] === option}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Card>
          </li>
        ))}
      </ol>

      {!preview && (
        <div className={s.submitBar}>
          <span className="muted">{t.test.answered(answered, total)}</span>
          <Button variant="primary" size="lg" loading={submit.isPending} disabled={answered === 0} onClick={onSubmit}>
            {submit.isPending ? t.test.submitting : t.test.submit}
          </Button>
        </div>
      )}
    </div>
  )
}
