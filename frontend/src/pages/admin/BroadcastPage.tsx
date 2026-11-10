import { useMutation } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { UserRole } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Choice, Field, Textarea } from '@/ui/controls'
import { Card, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import a from './Admin.module.css'

type Audience = 'all' | UserRole

export default function BroadcastPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<Audience>('all')

  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number }>('/admin/broadcast', { message: message.trim(), role: audience === 'all' ? null : audience }),
    onSuccess: (r) => {
      toast.success(t.admin.broadcastSent(r.recipients))
      setMessage('')
    },
    onError: toast.error,
  })

  return (
    <>
      <PageHeader title={t.admin.broadcast} subtitle={t.admin.broadcastSubtitle} />
      <Card className={a.settings}>
        <Field label={t.admin.broadcastMessage}>
          {(id) => <Textarea id={id} rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <fieldset style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: 8 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 560, marginBottom: 8 }}>{t.admin.broadcastAudience}</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {(['all', 'Student', 'Teacher', 'Admin'] as const).map((v) => (
              <Choice key={v} type="radio" name="audience" checked={audience === v} onChange={() => setAudience(v)}>
                {t.admin.audience[v]}
              </Choice>
            ))}
          </div>
        </fieldset>
        <div>
          <Button variant="primary" icon={<Megaphone aria-hidden />} disabled={!message.trim()} loading={send.isPending} onClick={() => send.mutate()}>
            {t.common.send}
          </Button>
        </div>
      </Card>
    </>
  )
}
