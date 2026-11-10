import { useMutation, useQuery } from '@tanstack/react-query'
import { Award, ClipboardCheck, Gauge, Mail, Star, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { api } from '@/api/client'
import type { CourseStudents } from '@/api/types'
import { FunnelBars } from '@/features/charts/Charts'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Field, Textarea } from '@/ui/controls'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  displayStyles as d,
  EmptyState,
  ErrorState,
  Loader,
  PageHeader,
  ProgressBar,
  StatGrid,
  StatTile,
} from '@/ui/display'
import { Modal, useToast } from '@/ui/overlay'
import s from './Teach.module.css'

function NotifyModal({ courseId, open, onClose }: { courseId: number; open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number }>(`/teach/courses/${courseId}/notify`, { message }),
    onSuccess: (r) => {
      toast.success(t.teach.notifySent(r.recipients))
      setMessage('')
      onClose()
    },
    onError: toast.error,
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.teach.notifyTitle}
      description={t.teach.notifyHint}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={!message.trim()} loading={send.isPending} onClick={() => send.mutate()}>
            {t.common.send}
          </Button>
        </>
      }
    >
      <Field>
        {(id) => (
          <Textarea
            id={id}
            rows={4}
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.teach.notifyPlaceholder}
            aria-label={t.teach.notifyTitle}
          />
        )}
      </Field>
    </Modal>
  )
}

export default function CourseStudentsPage() {
  const id = Number(useParams().id)
  const { t, f } = useI18n()
  const [notifyOpen, setNotifyOpen] = useState(false)
  const query = useQuery({ queryKey: ['teach', 'students', id], queryFn: () => api.get<CourseStudents>(`/teach/courses/${id}/students`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const { stats, students, funnel, courseTitle } = query.data

  return (
    <div className={s.stack}>
      <PageHeader
        back={{ to: `/teach/courses/${id}`, label: courseTitle }}
        title={t.teach.studentsTitle(courseTitle)}
        actions={
          students.length > 0 && (
            <Button variant="primary" icon={<Mail aria-hidden />} onClick={() => setNotifyOpen(true)}>
              {t.teach.notify}
            </Button>
          )
        }
      />

      <StatGrid>
        <StatTile icon={Users} label={t.teach.statStudents} value={f.number(stats.studentCount)} />
        <StatTile icon={Award} label={t.teach.statCompleted} value={f.number(stats.completedCount)} />
        <StatTile icon={Gauge} label={t.teach.averageProgress} value={`${Math.round(stats.averageProgress)}%`} />
        <StatTile icon={ClipboardCheck} label={t.teach.statScore} value={stats.averageScore === null ? '—' : `${Math.round(stats.averageScore)}%`} />
        <StatTile icon={Star} label={t.teach.statRating} value={f.rating(stats.rating)} />
        <StatTile icon={Wallet} label={t.teach.statRevenue} value={f.money(stats.revenue)} />
      </StatGrid>

      {students.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title={t.teach.studentsEmpty} />
        </Card>
      ) : (
        <>
          {funnel.length > 0 && (
            <Card>
              <CardHeader title={t.teach.funnel} hint={t.teach.funnelHint} />
              <FunnelBars rows={funnel.map((l) => ({ key: l.lessonId, label: l.title, value: l.completedCount }))} total={stats.studentCount} />
            </Card>
          )}

          <Card padded={false}>
            <div className={d.tableWrap}>
              <table className={d.table}>
                <thead>
                  <tr>
                    <th>{t.teach.studentColumns.student}</th>
                    <th>{t.teach.studentColumns.progress}</th>
                    <th className={d.numeric}>{t.teach.studentColumns.score}</th>
                    <th className={d.numeric}>{t.teach.studentColumns.attempts}</th>
                    <th>{t.teach.studentColumns.activity}</th>
                    <th>{t.teach.studentColumns.certificate}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.userId}>
                      <td>
                        <div className={s.studentCell}>
                          <Avatar name={st.name} size={32} />
                          <span>
                            <strong style={{ fontWeight: 600 }}>{st.name}</strong>
                            <span className={s.studentEmail}>{st.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={s.miniProgress}>
                          <ProgressBar value={st.progress} thin />
                          <span className="tabular" style={{ fontSize: 'var(--text-xs)', minWidth: 34, textAlign: 'right' }}>
                            {st.progress}%
                          </span>
                        </div>
                      </td>
                      <td className={d.numeric}>{st.averageScore === null ? '—' : `${Math.round(st.averageScore)}%`}</td>
                      <td className={d.numeric}>{st.attempts}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {st.lastActivityAt ? f.relative(st.lastActivityAt) : f.relative(st.enrolledAt)}
                      </td>
                      <td>
                        {st.hasCertificate ? (
                          <Badge tone="success" icon={<Award aria-hidden />}>
                            {t.common.yes}
                          </Badge>
                        ) : (
                          <Badge>{t.enrollmentStatus[st.status]}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <NotifyModal courseId={id} open={notifyOpen} onClose={() => setNotifyOpen(false)} />
    </div>
  )
}
