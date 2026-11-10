import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { NotificationPage } from '@/api/types'
import { useOpenNotification } from '@/features/notifications/NotificationBell'
import n from '@/features/notifications/Notifications.module.css'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/ui/controls'
import { Card, EmptyState, ErrorState, Loader, PageHeader, Pagination, Tabs } from '@/ui/display'

export default function NotificationsPage() {
  const { t, f } = useI18n()
  const queryClient = useQueryClient()
  const open = useOpenNotification()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['notifications', 'page', filter, page],
    queryFn: () => api.get<NotificationPage>('/notifications', { page, pageSize: 15, unreadOnly: filter === 'unread' }),
    placeholderData: keepPreviousData,
  })

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div style={{ maxWidth: 820, marginInline: 'auto' }}>
      <PageHeader
        title={t.notifications.title}
        actions={
          (query.data?.unreadCount ?? 0) > 0 && (
            <Button icon={<CheckCheck aria-hidden />} loading={readAll.isPending} onClick={() => readAll.mutate()}>
              {t.notifications.markAllRead}
            </Button>
          )
        }
      />
      <Tabs
        label={t.notifications.title}
        value={filter}
        onChange={(v) => {
          setFilter(v)
          setPage(1)
        }}
        items={[
          { value: 'all', label: t.notifications.all },
          { value: 'unread', label: t.notifications.unread, count: query.data?.unreadCount },
        ]}
      />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.page.items.length === 0 ? (
        <Card>
          <EmptyState icon={BellOff} title={filter === 'unread' ? t.notifications.empty : t.notifications.emptyAll} />
        </Card>
      ) : (
        <>
          <Card padded={false}>
            <ul className={n.pageList}>
              {query.data.page.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={n.item} data-unread={!item.isRead || undefined} onClick={() => open.mutate(item)}>
                    <span className={n.itemType}>{t.notificationTypes[item.type]}</span>
                    <span className={n.itemText}>{item.message}</span>
                    <span className={n.itemTime}>{f.dateTime(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={query.data.page.page} totalPages={query.data.page.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
