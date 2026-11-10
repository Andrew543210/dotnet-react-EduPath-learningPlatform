import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Archive,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Eye,
  FileText,
  ListPlus,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '@/api/client'
import type { CourseEditor, CourseStatus, EditorLesson, EditorTest } from '@/api/types'
import { CourseDetailsForm, type CourseFormValues } from '@/features/teaching/CourseDetailsForm'
import { LessonModal } from '@/features/teaching/LessonModal'
import { TestModal } from '@/features/teaching/TestModal'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink } from '@/ui/controls'
import { Badge, Callout, Card, CardHeader, EmptyState, ErrorState, Loader, PageHeader, Tabs, type Tone } from '@/ui/display'
import { useConfirm, useToast } from '@/ui/overlay'
import s from './Teach.module.css'

type Tab = 'details' | 'program' | 'publish'

const tones: Record<CourseStatus, Tone> = { Draft: 'neutral', PendingReview: 'warning', Published: 'success', Rejected: 'danger', Archived: 'neutral' }

function toForm(c: CourseEditor): CourseFormValues {
  return {
    title: c.title,
    summary: c.summary,
    description: c.description,
    categoryId: c.categoryId,
    level: c.level,
    price: c.price,
    outcomes: c.outcomes.length ? c.outcomes.map((value) => ({ value })) : [{ value: '' }],
  }
}

function ProgramTab({ course, onChange }: { course: CourseEditor; onChange: (c: CourseEditor) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const [lessonModal, setLessonModal] = useState<{ lesson: EditorLesson | null } | null>(null)
  const [testModal, setTestModal] = useState<{ lessonId: number; test: EditorTest | null } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const run = async (lessonId: number, action: () => Promise<CourseEditor>) => {
    setBusy(lessonId)
    try {
      onChange(await action())
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }

  const currentLesson = lessonModal?.lesson ? (course.lessons.find((l) => l.id === lessonModal.lesson!.id) ?? null) : null

  return (
    <>
      <Card>
        <CardHeader
          title={t.teach.tabs.program}
          hint={t.common.lessons(course.lessons.length)}
          action={
            <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setLessonModal({ lesson: null })}>
              {t.teach.program.addLesson}
            </Button>
          }
        />
        {course.lessons.length === 0 ? (
          <EmptyState icon={ListPlus} title={t.teach.program.empty} />
        ) : (
          <ol className={s.lessons}>
            {course.lessons.map((lesson, i) => {
              const test = lesson.tests[0] ?? null
              return (
                <li key={lesson.id} className={s.lesson} aria-busy={busy === lesson.id}>
                  <span className={s.lessonNumber}>{i + 1}</span>
                  <div className={s.lessonInfo}>
                    <span className={s.lessonTitle}>{lesson.title}</span>
                    <span className={s.lessonMeta}>
                      <span>{t.common.duration(lesson.durationMinutes)}</span>
                      {lesson.videoUrl && (
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <Video width={14} height={14} aria-hidden />
                          {t.lesson.video}
                        </span>
                      )}
                      {lesson.materialName && (
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <FileText width={14} height={14} aria-hidden />
                          {lesson.materialName}
                        </span>
                      )}
                      {test ? (
                        <button
                          type="button"
                          onClick={() => setTestModal({ lessonId: lesson.id, test })}
                          style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer' }}
                        >
                          <Badge tone="accent" icon={<ClipboardCheck aria-hidden />}>
                            {test.title}, {t.common.questions(test.questions.length)}
                          </Badge>
                        </button>
                      ) : (
                        <span className="subtle">{t.teach.program.noTest}</span>
                      )}
                    </span>
                  </div>
                  <div className={s.lessonActions}>
                    {!test && (
                      <Button size="sm" variant="ghost" icon={<ClipboardCheck aria-hidden />} onClick={() => setTestModal({ lessonId: lesson.id, test: null })}>
                        {t.teach.program.addTest}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" iconOnly aria-label={t.teach.program.moveUp} icon={<ArrowUp />} disabled={i === 0 || busy !== null}
                      onClick={() => run(lesson.id, () => api.post<CourseEditor>(`/teach/lessons/${lesson.id}/move`, { position: i }))} />
                    <Button size="sm" variant="ghost" iconOnly aria-label={t.teach.program.moveDown} icon={<ArrowDown />} disabled={i === course.lessons.length - 1 || busy !== null}
                      onClick={() => run(lesson.id, () => api.post<CourseEditor>(`/teach/lessons/${lesson.id}/move`, { position: i + 2 }))} />
                    <Button size="sm" variant="ghost" iconOnly aria-label={t.common.edit} icon={<Pencil />} onClick={() => setLessonModal({ lesson })} />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      aria-label={t.teach.program.deleteLesson}
                      icon={<Trash2 />}
                      onClick={async () => {
                        if (await confirm({ title: t.teach.program.deleteLesson, text: t.teach.program.deleteLessonConfirm(lesson.title), danger: true, confirmLabel: t.common.delete }))
                          void run(lesson.id, () => api.delete<CourseEditor>(`/teach/lessons/${lesson.id}`))
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      {lessonModal && (
        <LessonModal
          key={lessonModal.lesson?.id ?? 'new'}
          courseId={course.id}
          lesson={currentLesson}
          open
          onClose={() => setLessonModal(null)}
          onSaved={onChange}
        />
      )}
      {testModal && (
        <TestModal
          key={testModal.test?.id ?? `new-${testModal.lessonId}`}
          lessonId={testModal.lessonId}
          test={testModal.test}
          defaultPassingScore={70}
          open
          onClose={() => setTestModal(null)}
          onSaved={onChange}
        />
      )}
    </>
  )
}

function PublishTab({ course, onChange }: { course: CourseEditor; onChange: (c: CourseEditor) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const action = useMutation({
    mutationFn: (kind: 'submit' | 'archive') => api.post<CourseEditor>(`/teach/courses/${course.id}/${kind}`),
    onSuccess: (editor, kind) => {
      onChange(editor)
      toast.success(kind === 'submit' ? (editor.status === 'Published' ? t.admin.approved : t.teach.publish.submitted) : t.teach.publish.archived)
    },
    onError: toast.error,
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/teach/courses/${course.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teach'] })
      toast.success(t.teach.publish.deleted)
      navigate('/teach/courses', { replace: true })
    },
    onError: toast.error,
  })

  const hasLessons = course.lessons.length > 0
  const hasTests = course.lessons.some((l) => l.tests.length > 0)
  const hasOutcomes = course.outcomes.length > 0
  const checks = [
    { ok: hasLessons, label: t.teach.publish.checkLessons },
    { ok: hasTests, label: t.teach.publish.checkTests },
    { ok: hasOutcomes, label: t.teach.publish.checkOutcomes },
  ]
  const canSubmit = course.status === 'Draft' || course.status === 'Rejected'

  return (
    <div className={s.stack}>
      <Card className={s.statusPanel}>
        <CardHeader title={t.teach.publish.statusTitle} action={<Badge tone={tones[course.status]}>{t.courseStatus[course.status]}</Badge>} />
        <p>{t.teach.publish[course.status]}</p>
        {course.status === 'Rejected' && course.moderationComment && (
          <Callout tone="warning" title={t.course.moderationNote}>
            {course.moderationComment}
          </Callout>
        )}
        {canSubmit && (
          <>
            <p style={{ fontWeight: 620, fontSize: 'var(--text-sm)' }}>{t.teach.publish.checklist}</p>
            <ul className={s.checklist}>
              {checks.map((c) => (
                <li key={c.label}>
                  {c.ok ? <CheckCircle2 className={s.checkOk} aria-label="✓" /> : <Circle className={s.checkMissing} aria-label="—" />}
                  {c.label}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={s.formActions} style={{ justifyContent: 'flex-start' }}>
          {canSubmit && (
            <Button variant="primary" icon={<Send aria-hidden />} disabled={!hasLessons} loading={action.isPending} onClick={() => action.mutate('submit')}>
              {t.teach.publish.submit}
            </Button>
          )}
          {course.status === 'Published' && (
            <Button
              icon={<Archive aria-hidden />}
              loading={action.isPending}
              onClick={async () => {
                if (await confirm({ title: t.teach.publish.archive, text: t.teach.publish.archiveConfirm, confirmLabel: t.teach.publish.archive })) action.mutate('archive')
              }}
            >
              {t.teach.publish.archive}
            </Button>
          )}
          <ButtonLink to={`/courses/${course.id}`} variant="ghost" icon={<Eye aria-hidden />}>
            {t.teach.viewPublic}
          </ButtonLink>
        </div>
      </Card>

      {course.studentCount === 0 && course.status !== 'Published' && (
        <Card>
          <CardHeader title={t.teach.publish.deleteCourse} />
          <p className="muted" style={{ marginBottom: 16 }}>
            {t.teach.publish.deleteConfirm}
          </p>
          <Button
            variant="danger"
            icon={<Trash2 aria-hidden />}
            loading={remove.isPending}
            onClick={async () => {
              if (await confirm({ title: t.teach.publish.deleteCourse, text: t.teach.publish.deleteConfirm, danger: true, confirmLabel: t.common.delete })) remove.mutate()
            }}
          >
            {t.teach.publish.deleteCourse}
          </Button>
        </Card>
      )}
    </div>
  )
}

export default function CourseEditorPage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'details'
  const key = ['teach', 'course', id]
  const query = useQuery({ queryKey: key, queryFn: () => api.get<CourseEditor>(`/teach/courses/${id}`) })

  const apply = (editor: CourseEditor) => {
    queryClient.setQueryData(key, editor)
    queryClient.invalidateQueries({ queryKey: ['teach', 'courses'] })
    queryClient.invalidateQueries({ queryKey: ['course', id] })
  }

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const course = query.data

  return (
    <div className={s.stack}>
      <PageHeader
        back={{ to: '/teach/courses', label: t.teach.courses }}
        title={course.title}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={tones[course.status]}>{t.courseStatus[course.status]}</Badge>
            {t.common.students(course.studentCount)}
          </span>
        }
        actions={
          <>
            <ButtonLink to={`/teach/courses/${id}/students`} icon={<Users aria-hidden />}>
              {t.teach.students}
            </ButtonLink>
            <ButtonLink to={`/courses/${id}`} variant="ghost" icon={<Eye aria-hidden />}>
              {t.teach.viewPublic}
            </ButtonLink>
          </>
        }
      />

      {course.status === 'Rejected' && course.moderationComment && tab !== 'publish' && (
        <Callout tone="warning" title={t.course.moderationNote}>
          {course.moderationComment}
        </Callout>
      )}

      <div>
        <Tabs<Tab>
          label={course.title}
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          items={[
            { value: 'details', label: t.teach.tabs.details },
            { value: 'program', label: t.teach.tabs.program, count: course.lessons.length },
            { value: 'publish', label: t.teach.tabs.publish },
          ]}
        />
        {tab === 'details' && (
          <Card>
            <CourseDetailsForm
              key={course.updatedAt}
              initial={toForm(course)}
              submitLabel={t.common.save}
              onSubmit={async (payload) => {
                try {
                  apply(await api.put<CourseEditor>(`/teach/courses/${id}`, payload))
                  toast.success(t.common.saved)
                } catch (e) {
                  toast.error(e)
                  throw e
                }
              }}
            />
          </Card>
        )}
        {tab === 'program' && <ProgramTab course={course} onChange={apply} />}
        {tab === 'publish' && <PublishTab course={course} onChange={apply} />}
      </div>
    </div>
  )
}
