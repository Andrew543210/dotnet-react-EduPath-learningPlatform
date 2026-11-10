import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { AdminReview, PagedResult } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/ui/controls'
import { Card, EmptyState, ErrorState, Loader, PageHeader, Pagination, Stars } from '@/ui/display'
import { useConfirm, useToast } from '@/ui/overlay'
import a from './Admin.module.css'

export default function ReviewsPage() {
  const { t, f } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin', 'reviews', page],
    queryFn: () => api.get<PagedResult<AdminReview>>('/admin/reviews', { page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success(t.reviews.removedToast)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: toast.error,
  })

  return (
    <>
      <PageHeader title={t.admin.reviews} subtitle={t.admin.reviewsSubtitle} />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquare} title={t.admin.reviewsEmpty} />
        </Card>
      ) : (
        <>
          <Card>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {query.data.items.map((r) => (
                <li key={r.id} className={a.review}>
                  <div>
                    <div className={a.reviewMeta}>
                      <Stars value={r.rating} />
                      <strong>{r.authorName}</strong>
                      <Link to={`/courses/${r.courseId}`}>{r.courseTitle}</Link>
                      <span className="subtle">{f.date(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className={a.reviewText}>{r.comment}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 aria-hidden />}
                    onClick={async () => {
                      if (await confirm({ title: t.admin.deleteReviewConfirm, text: r.comment || undefined, danger: true, confirmLabel: t.common.delete }))
                        remove.mutate(r.id)
                    }}
                  >
                    {t.common.delete}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  )
}
