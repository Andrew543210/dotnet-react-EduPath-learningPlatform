import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { Settings } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Field, Input, Switch } from '@/ui/controls'
import { Card, ErrorState, Loader, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import a from './Admin.module.css'

export default function SettingsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<Settings>('/admin/settings') })
  const [draft, setDraft] = useState<Settings | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (query.data) setDraft(query.data)
  }, [query.data])

  const save = useMutation({
    mutationFn: (value: Settings) => api.put<Settings>('/admin/settings', value),
    onSuccess: (value) => {
      queryClient.setQueryData(['admin', 'settings'], value)
      queryClient.invalidateQueries({ queryKey: ['settings', 'public'] })
      setErrors({})
      toast.success(t.common.saved)
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])))
      else toast.error(e)
    },
  })

  if (query.isPending || !draft) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value })
  const dirty = JSON.stringify(draft) !== JSON.stringify(query.data)

  return (
    <>
      <PageHeader title={t.admin.settings} subtitle={t.admin.settingsSubtitle} />
      <Card className={a.settings}>
        <form
          style={{ display: 'grid', gap: 20 }}
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate({ ...draft, defaultPassingScore: Number(draft.defaultPassingScore) })
          }}
        >
          <Field label={t.admin.platformName} error={errors.platformName}>
            {(id, describedBy, invalid) => (
              <Input id={id} value={draft.platformName} onChange={(e) => set('platformName', e.target.value)} aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
          <Field label={t.admin.supportEmail} error={errors.supportEmail}>
            {(id, describedBy, invalid) => (
              <Input id={id} type="email" value={draft.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
          <Field label={t.admin.defaultPassingScore} error={errors.defaultPassingScore}>
            {(id, describedBy, invalid) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={100}
                style={{ maxWidth: 160 }}
                value={draft.defaultPassingScore}
                onChange={(e) => set('defaultPassingScore', Number(e.target.value))}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <div className={a.divider} />
          <Switch
            label={t.admin.allowTeacherRegistration}
            hint={t.admin.allowTeacherRegistrationHint}
            checked={draft.allowTeacherRegistration}
            onChange={(v) => set('allowTeacherRegistration', v)}
          />
          <Switch
            label={t.admin.requireCourseModeration}
            hint={t.admin.requireCourseModerationHint}
            checked={draft.requireCourseModeration}
            onChange={(v) => set('requireCourseModeration', v)}
          />
          <div>
            <Button type="submit" variant="primary" disabled={!dirty} loading={save.isPending}>
              {t.common.save}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
