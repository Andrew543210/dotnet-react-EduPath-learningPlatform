import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { api } from '@/api/client'
import type { Notification, NotificationPage } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/ui/controls'
import { Dropdown } from '@/ui/overlay'
import s from './Notifications.module.css'

export function useOpenNotification() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (n: Notification) => (n.isRead ? Promise.resolve(n) : api.post<Notification>(`/notifications/${n.id}/open`)),
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      if (n.link) navigate(n.link)
    },
  })
}

export function NotificationBell() {
  const { t, f } = useI18n()
  const queryClient = useQueryClient()
  const open = useOpenNotification()

  const { data } = useQuery({
    queryKey: ['notifications', 'bell'],
    queryFn: () => api.get<NotificationPage>('/notifications', { pageSize: 6 }),
    refetchInterval: 60_000,
  })

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = data?.unreadCount ?? 0
  const items = data?.page.items ?? []

  return (
    <Dropdown
      label={t.nav.notifications}
      trigger={({ toggle, open: isOpen }) => (
        <button
          type="button"
          className={s.bell}
          onClick={toggle}
          aria-expanded={isOpen}
          aria-label={unread ? `${t.nav.notifications}: ${unread}` : t.nav.notifications}
        >
          <Bell aria-hidden />
          {unread > 0 && <span className={s.count}>{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div className={s.panel}>
          <div className={s.panelHead}>
            <strong>{t.notifications.title}</strong>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => readAll.mutate()}>
                {t.notifications.markAllRead}
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <p className={s.panelEmpty}>{t.notifications.emptyAll}</p>
          ) : (
            <ul className={s.list}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={s.item}
                    data-unread={!n.isRead || undefined}
                    onClick={() => {
                      close()
                      open.mutate(n)
                    }}
                  >
                    <span className={s.itemType}>{t.notificationTypes[n.type]}</span>
                    <span className={s.itemText}>{n.message}</span>
                    <span className={s.itemTime}>{f.relative(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className={s.panelFoot} onClick={close}>
            {t.notifications.viewAll}
          </Link>
        </div>
      )}
    </Dropdown>
  )
}
