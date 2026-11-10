import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, ShieldCheck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { ModerationItem } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink, Field, Textarea } from '@/ui/controls'
import { Callout, Card, CourseCover, EmptyState, ErrorState, Loader, PageHeader, Tabs } from '@/ui/display'
import { Modal, useToast } from '@/ui/overlay'
import a from './Admin.module.css'

type Status = 'PendingReview' | 'Rejected' | 'Published'

export default function ModerationPage() {
  const { t, f } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('PendingReview')
  const [rejecting, setRejecting] = useState<ModerationItem | null>(null)
  const [comment, setComment] = useState('')

  const query = useQuery({
    queryKey: ['admin', 'moderation', status],
    queryFn: () => api.get<ModerationItem[]>('/admin/moderation', { status }),
  })

  const done = (message: string) => {
    toast.success(message)
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['courses'] })
  }

  const approve = useMutation({
    mutationFn: (id: number) => api.post(`/admin/moderation/${id}/approve`),
    onSuccess: () => done(t.admin.approved),
    onError: toast.error,
  })

  const reject = useMutation({
    mutationFn: () => api.post(`/admin/moderation/${rejecting!.course.id}/reject`, { comment }),
    onSuccess: () => {
      setRejecting(null)
      setComment('')
      done(t.admin.rejected)
    },
    onError: toast.error,
  })

  return (
    <>
      <PageHeader title={t.admin.moderation} subtitle={t.admin.moderationSubtitle} />
      <Tabs<Status>
        label={t.admin.moderation}
        value={status}
        onChange={setStatus}
        items={(['PendingReview', 'Rejected', 'Published'] as const).map((v) => ({
          value: v,
          label: t.admin.tabs[v],
          count: v === status ? query.data?.length : undefined,
        }))}
      />

      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title={status === 'PendingReview' ? t.admin.pendingEmpty : t.admin.moderationEmpty} />
        </Card>
      ) : (
        <div className={a.moderation}>
          {query.data.map((item) => (
            <Card key={item.course.id} className={a.modItem} padded={false}>
              <CourseCover trail={item.course.trail} seed={item.course.id} height={100} className={a.modCover} />
              <div className={a.modBody}>
                <h2 className={a.modTitle}>{item.course.title}</h2>
                <p className={a.modMeta}>
                  {item.course.teacherName}, {item.course.categoryName}, {t.levels[item.course.level].toLowerCase()}.{' '}
                  {t.common.lessons(item.course.lessonCount)}, {t.common.tests(item.testCount)},{' '}
                  {item.course.price === 0 ? t.common.free.toLowerCase() : f.money(item.course.price)}. {f.relative(item.course.updatedAt)}
                </p>
                <p style={{ fontSize: 'var(--text-sm)' }}>{item.course.summary}</p>
                {item.moderationComment && (
                  <Callout tone="warning" title={t.course.moderationNote}>
                    {item.moderationComment}
                  </Callout>
                )}
                <div className={a.modActions}>
                  <ButtonLink to={`/courses/${item.course.id}`} size="sm" icon={<Eye aria-hidden />}>
                    {t.admin.preview}
                  </ButtonLink>
                  {status === 'PendingReview' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Check aria-hidden />}
                        loading={approve.isPending && approve.variables === item.course.id}
                        onClick={() => approve.mutate(item.course.id)}
                      >
                        {t.admin.approve}
                      </Button>
                      <Button size="sm" variant="danger" icon={<Undo2 aria-hidden />} onClick={() => setRejecting(item)}>
                        {t.admin.reject}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={t.admin.rejectTitle}
        description={rejecting ? `«${rejecting.course.title}». ${t.admin.rejectHint}` : undefined}
        footer={
          <>
            <Button onClick={() => setRejecting(null)}>{t.common.cancel}</Button>
            <Button variant="danger" disabled={comment.trim().length < 5} loading={reject.isPending} onClick={() => reject.mutate()}>
              {t.admin.reject}
            </Button>
          </>
        }
      >
        <Field>{(id) => <Textarea id={id} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} aria-label={t.admin.rejectTitle} />}</Field>
      </Modal>
    </>
  )
}
