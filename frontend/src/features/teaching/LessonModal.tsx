import { useState } from 'react'
import { Paperclip, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type { CourseEditor, EditorLesson } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import s from '@/pages/teach/Teach.module.css'
import { Button, Field, Input, Segmented, Textarea } from '@/ui/controls'
import { Markdown } from '@/ui/Markdown'
import { Modal, useToast } from '@/ui/overlay'

type Errors = Partial<Record<'title' | 'durationMinutes' | 'videoUrl' | 'content', string>>

export function LessonModal({
  courseId,
  lesson,
  open,
  onClose,
  onSaved,
}: {
  courseId: number
  lesson: EditorLesson | null
  open: boolean
  onClose: () => void
  onSaved: (editor: CourseEditor) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [duration, setDuration] = useState(String(lesson?.durationMinutes ?? 15))
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '')
  const [content, setContent] = useState(lesson?.content ?? '')
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const validate = () => {
    const next: Errors = {}
    if (!title.trim()) next.title = t.validation.required
    const d = Number(duration)
    if (!Number.isInteger(d) || d < 1 || d > 600) next.durationMinutes = t.validation.range(1, 600)
    if (videoUrl.trim() && !/^https?:\/\/\S+$/.test(videoUrl.trim())) next.videoUrl = t.validation.url
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const body = { title: title.trim(), content, durationMinutes: Number(duration), videoUrl: videoUrl.trim() || null }
      const editor = lesson
        ? await api.put<CourseEditor>(`/teach/lessons/${lesson.id}`, body)
        : await api.post<CourseEditor>(`/teach/courses/${courseId}/lessons`, body)
      onSaved(editor)
      toast.success(t.common.saved)
      onClose()
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])) as Errors)
      } else toast.error(e)
    } finally {
      setSaving(false)
    }
  }

  const upload = async (file: File) => {
    if (!lesson) return
    if (file.size > 20 * 1024 * 1024) {
      toast.error(new Error(t.teach.program.maxSize))
      return
    }
    setUploading(true)
    try {
      onSaved(await api.upload<CourseEditor>(`/teach/lessons/${lesson.id}/material`, file))
      toast.success(t.common.saved)
    } catch (e) {
      toast.error(e)
    } finally {
      setUploading(false)
    }
  }

  const removeMaterial = async () => {
    if (!lesson) return
    try {
      onSaved(await api.delete<CourseEditor>(`/teach/lessons/${lesson.id}/material`))
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={lesson ? t.teach.program.editLesson : t.teach.program.newLesson}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className={s.formGrid}>
        <Field label={t.teach.program.lessonTitle} error={errors.title}>
          {(id, describedBy, invalid) => (
            <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>
        <div className={s.formRow} style={{ gridTemplateColumns: '160px 1fr' }}>
          <Field label={t.teach.program.duration} error={errors.durationMinutes}>
            {(id, describedBy, invalid) => (
              <Input id={id} type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
          <Field label={t.teach.program.videoUrl} optional={t.common.optional} error={errors.videoUrl}>
            {(id, describedBy, invalid) => (
              <Input id={id} type="url" placeholder="https://" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
        </div>
        <Field label={t.teach.program.content} hint={t.teach.program.contentHint} error={errors.content}>
          {(id, describedBy, invalid) => (
            <div>
              <div className={s.editorTabs}>
                <Segmented
                  label={t.teach.program.content}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'write', label: t.teach.program.write },
                    { value: 'preview', label: t.teach.program.preview },
                  ]}
                />
              </div>
              {mode === 'write' ? (
                <Textarea id={id} rows={14} mono value={content} onChange={(e) => setContent(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
              ) : (
                <div className={s.preview}>
                  <Markdown>{content || '—'}</Markdown>
                </div>
              )}
            </div>
          )}
        </Field>

        {lesson && (
          <div className={s.formGrid} style={{ gap: 6 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 560 }}>{t.teach.program.material}</span>
            <div className={s.material}>
              {lesson.materialUrl && (
                <>
                  <a href={lesson.materialUrl} target="_blank" rel="noreferrer">
                    {lesson.materialName}
                  </a>
                  <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden />} onClick={removeMaterial}>
                    {t.teach.program.removeMaterial}
                  </Button>
                </>
              )}
              <label className="visually-hidden" htmlFor={`material-${lesson.id}`}>
                {t.teach.program.upload}
              </label>
              <input
                id={`material-${lesson.id}`}
                type="file"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void upload(file)
                }}
              />
              <Button
                size="sm"
                icon={<Paperclip aria-hidden />}
                loading={uploading}
                onClick={() => document.getElementById(`material-${lesson.id}`)?.click()}
              >
                {lesson.materialUrl ? t.teach.program.replace : t.teach.program.upload}
              </Button>
              <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                {t.teach.program.maxSize}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
