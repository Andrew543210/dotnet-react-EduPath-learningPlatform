import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '@/api/client'
import type { NotificationPage } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { useToast } from '@/ui/overlay'

const affected: Record<string, string[][]> = {
  Course: [['my-courses'], ['teach']],
  Payment: [['payments'], ['my-courses']],
  Test: [['my-results'], ['my-courses']],
  Certificate: [['certificates'], ['my-courses']],
  Moderation: [['teach'], ['admin']],
  General: [],
  Announcement: [],
}

export function useRealtimeNotifications() {
  const { token } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const latest = useRef({ t, toast })
  latest.current = { t, toast }

  useEffect(() => {
    if (!token) return
    const shown = new Set<number>()
    let connection: HubConnection | null = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build()

    let queue = Promise.resolve()
    const handle = async (payload: { type?: string }) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      for (const key of affected[payload?.type ?? 'General'] ?? []) queryClient.invalidateQueries({ queryKey: key })
      const page = await api.get<NotificationPage>('/notifications', { pageSize: 5, unreadOnly: true }).catch(() => null)
      if (!page) return
      const fresh = page.page.items.filter((n) => !shown.has(n.id) && Date.now() - new Date(n.createdAt).getTime() < 60_000)
      for (const item of fresh.reverse()) {
        shown.add(item.id)
        latest.current.toast.show({ tone: 'notification', title: latest.current.t.notifications.newToast, message: item.message, link: item.link })
      }
    }
    connection.on('notification', (payload: { type?: string }) => {
      queue = queue.then(() => handle(payload))
    })

    connection.start().catch(() => undefined)

    return () => {
      const current = connection
      connection = null
      void current?.stop()
    }
  }, [token, queryClient])
}
