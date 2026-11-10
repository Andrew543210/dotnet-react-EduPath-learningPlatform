import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { CourseReviews as CourseReviewsDto, Review } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Field, Textarea } from '@/ui/controls'
import { Avatar, Card, EmptyState, StarInput, Stars } from '@/ui/display'
import { useConfirm, useToast } from '@/ui/overlay'
import s from './CourseReviews.module.css'

function ReviewForm({ courseId, mine }: { courseId: number; mine: Review | null }) {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')

  useEffect(() => {
    setRating(mine?.rating ?? 0)
    setComment(mine?.comment ?? '')
  }, [mine])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', courseId] })
    queryClient.invalidateQueries({ queryKey: ['course', courseId] })
  }

  const save = useMutation({
    mutationFn: () => api.put<Review>(`/courses/${courseId}/reviews/mine`, { rating, comment }),
    onSuccess: () => {
      toast.success(t.reviews.savedToast)
      refresh()
    },
    onError: toast.error,
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}/reviews/mine`),
    onSuccess: () => {
      toast.success(t.reviews.removedToast)
      refresh()
    },
    onError: toast.error,
  })

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <p className={s.formTitle}>{t.reviews.writeTitle}</p>
      <StarInput value={rating} onChange={setRating} label={t.reviews.rating} />
      <Field optional={t.common.optional}>
        {(id) => (
          <Textarea
            id={id}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.reviews.commentPlaceholder}
            maxLength={2000}
            aria-label={t.reviews.writeTitle}
            rows={3}
          />
        )}
      </Field>
      <div className={s.formActions}>
        <Button type="submit" variant="primary" disabled={rating === 0} loading={save.isPending}>
          {mine ? t.reviews.update : t.reviews.submit}
        </Button>
        {mine && (
          <Button
            variant="ghost"
            loading={remove.isPending}
            onClick={async () => {
              if (await confirm({ title: t.reviews.remove, danger: true, confirmLabel: t.common.delete })) remove.mutate()
            }}
          >
            {t.reviews.remove}
          </Button>
        )}
      </div>
    </form>
  )
}

export function CourseReviews({ courseId, canReview }: { courseId: number; canReview: boolean }) {
  const { t, f } = useI18n()
  const [pageSize, setPageSize] = useState(5)
  const { data } = useQuery({
    queryKey: ['reviews', courseId, pageSize],
    queryFn: () => api.get<CourseReviewsDto>(`/courses/${courseId}/reviews`, { pageSize }),
  })

  if (!data) return null
  const { summary, page, mine } = data
  const max = Math.max(1, ...summary.distribution)

  return (
    <div className={s.wrap}>
      {summary.count > 0 && (
        <div className={s.summary}>
          <div className={s.average}>
            <span className={s.averageValue}>{f.rating(summary.average)}</span>
            <Stars value={summary.average} />
            <span className={s.basedOn}>{t.reviews.basedOn(summary.count)}</span>
          </div>
          <ul className={s.bars} aria-label={t.reviews.rating}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star - 1] ?? 0
              return (
                <li key={star} className={s.barRow}>
                  <span className={s.barLabel}>{star}</span>
                  <span className={s.barTrack}>
                    <span style={{ width: `${(count / max) * 100}%` }} />
                  </span>
                  <span className={s.barCount}>{count}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {canReview && <ReviewForm courseId={courseId} mine={mine} />}

      {page.items.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquare} title={t.reviews.empty} />
        </Card>
      ) : (
        <ul className={s.list}>
          {page.items.map((r) => (
            <li key={r.id} className={s.review}>
              <Avatar name={r.authorName} size={38} />
              <div className={s.reviewBody}>
                <div className={s.reviewHead}>
                  <strong>{r.authorName}</strong>
                  <span className={s.reviewDate}>{f.date(r.createdAt)}</span>
                </div>
                <Stars value={r.rating} />
                {r.comment && <p className={s.reviewText}>{r.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {page.totalCount > page.items.length && (
        <Button variant="secondary" onClick={() => setPageSize((n) => n + 10)}>
          {t.reviews.more}
        </Button>
      )}
    </div>
  )
}
