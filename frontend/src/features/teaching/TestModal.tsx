import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { CourseEditor, EditorTest } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import s from '@/pages/teach/Teach.module.css'
import { Button, Field, Input } from '@/ui/controls'
import { Callout } from '@/ui/display'
import { Modal, useConfirm, useToast } from '@/ui/overlay'

interface DraftQuestion {
  key: number
  text: string
  options: string[]
  correct: number
  explanation: string
}

let keySeed = 1
const blankQuestion = (): DraftQuestion => ({ key: keySeed++, text: '', options: ['', ''], correct: -1, explanation: '' })

function fromTest(test: EditorTest | null): DraftQuestion[] {
  if (!test) return [blankQuestion()]
  return test.questions.map((q) => ({
    key: keySeed++,
    text: q.text,
    options: [...q.options],
    correct: q.options.indexOf(q.correctAnswer),
    explanation: q.explanation ?? '',
  }))
}

export function TestModal({
  lessonId,
  test,
  defaultPassingScore,
  open,
  onClose,
  onSaved,
}: {
  lessonId: number
  test: EditorTest | null
  defaultPassingScore: number
  open: boolean
  onClose: () => void
  onSaved: (editor: CourseEditor) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const [title, setTitle] = useState(test?.title ?? '')
  const [threshold, setThreshold] = useState(String(test?.passingScore ?? defaultPassingScore))
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => fromTest(test))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const locked = test?.hasResults ?? false

  const patch = (key: number, change: Partial<DraftQuestion>) =>
    setQuestions((list) => list.map((q) => (q.key === key ? { ...q, ...change } : q)))

  const save = async () => {
    setError(null)
    const score = Number(threshold)
    if (!title.trim()) return setError(`${t.teach.testEditor.title}: ${t.validation.required}`)
    if (!Number.isInteger(score) || score < 1 || score > 100) return setError(`${t.teach.testEditor.threshold}: ${t.validation.range(1, 100)}`)
    const cleaned = questions.map((q) => ({ ...q, options: q.options.map((o) => o.trim()) }))
    if (cleaned.some((q) => !q.text.trim() || q.options.filter(Boolean).length < 2)) return setError(t.validation.required)
    if (cleaned.some((q) => q.correct < 0 || !q.options[q.correct])) return setError(t.teach.testEditor.pickCorrect)

    const body = {
      title: title.trim(),
      passingScore: score,
      questions: cleaned.map((q) => ({
        text: q.text.trim(),
        options: q.options.filter(Boolean),
        correctAnswer: q.options[q.correct],
        explanation: q.explanation.trim() || null,
      })),
    }
    setSaving(true)
    try {
      const editor = test ? await api.put<CourseEditor>(`/teach/tests/${test.id}`, body) : await api.post<CourseEditor>(`/teach/lessons/${lessonId}/tests`, body)
      onSaved(editor)
      toast.success(t.common.saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!test || !(await confirm({ title: t.teach.testEditor.deleteTest, text: t.teach.testEditor.deleteConfirm, danger: true, confirmLabel: t.common.delete }))) return
    try {
      onSaved(await api.delete<CourseEditor>(`/teach/tests/${test.id}`))
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={test ? t.teach.testEditor.editTitle : t.teach.testEditor.newTitle}
      footer={
        <>
          {test && !locked && (
            <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={remove} style={{ marginRight: 'auto' }}>
              {t.teach.testEditor.deleteTest}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className={s.formGrid}>
        {locked && <Callout tone="warning">{t.teach.testEditor.locked}</Callout>}
        {error && <Callout tone="danger">{error}</Callout>}
        <div className={s.formRow} style={{ gridTemplateColumns: '1fr 200px' }}>
          <Field label={t.teach.testEditor.title}>{(id) => <Input id={id} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label={t.teach.testEditor.threshold}>
            {(id) => <Input id={id} type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />}
          </Field>
        </div>

        {questions.map((q, qi) => (
          <fieldset key={q.key} className={s.question} disabled={locked} style={{ margin: 0 }}>
            <div className={s.questionHead}>
              <legend style={{ padding: 0, float: 'left' }}>{t.teach.testEditor.question(qi + 1)}</legend>
              {questions.length > 1 && (
                <Button size="sm" variant="ghost" icon={<X aria-hidden />} onClick={() => setQuestions((l) => l.filter((x) => x.key !== q.key))}>
                  {t.teach.testEditor.removeQuestion}
                </Button>
              )}
            </div>
            <Input placeholder={t.teach.testEditor.questionText} aria-label={t.teach.testEditor.questionText} value={q.text} onChange={(e) => patch(q.key, { text: e.target.value })} />
            {q.options.map((option, oi) => (
              <div key={oi} className={s.optionRow}>
                <label>
                  <input type="radio" name={`correct-${q.key}`} checked={q.correct === oi} onChange={() => patch(q.key, { correct: oi })} />
                  {t.teach.testEditor.correct}
                </label>
                <Input
                  placeholder={t.teach.testEditor.option(oi + 1)}
                  aria-label={t.teach.testEditor.option(oi + 1)}
                  value={option}
                  onChange={(e) => patch(q.key, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={t.common.delete}
                  icon={<X />}
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    patch(q.key, {
                      options: q.options.filter((_, i) => i !== oi),
                      correct: q.correct === oi ? -1 : q.correct > oi ? q.correct - 1 : q.correct,
                    })
                  }
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" variant="soft" icon={<Plus aria-hidden />} disabled={q.options.length >= 6} onClick={() => patch(q.key, { options: [...q.options, ''] })}>
                {t.teach.testEditor.addOption}
              </Button>
            </div>
            <Input
              placeholder={t.teach.testEditor.explanation}
              aria-label={t.teach.testEditor.explanation}
              value={q.explanation}
              onChange={(e) => patch(q.key, { explanation: e.target.value })}
            />
          </fieldset>
        ))}

        {!locked && (
          <div>
            <Button icon={<Plus aria-hidden />} onClick={() => setQuestions((l) => [...l, blankQuestion()])}>
              {t.teach.testEditor.addQuestion}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
