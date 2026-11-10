import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api, ApiError } from '@/api/client'
import type { User } from '@/api/types'
import { useTheme, type Theme } from '@/app/ThemeProvider'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n, type Language } from '@/i18n/I18nProvider'
import { passwordSchema } from '@/lib/validation'
import { Button, Field, Input, Segmented, Textarea } from '@/ui/controls'
import { Avatar, Badge, Card, CardHeader, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import s from './Student.module.css'

function ProfileForm({ user }: { user: User }) {
  const { t } = useI18n()
  const { updateUser } = useAuth()
  const toast = useToast()
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t.validation.required).max(100, t.validation.max(100)),
        headline: z.string().max(160, t.validation.max(160)),
        bio: z.string().max(2000, t.validation.max(2000)),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, headline: user.headline ?? '', bio: user.bio ?? '' },
  })
  const save = useMutation({
    mutationFn: (values: Values) => api.put<User>('/auth/me', values),
    onSuccess: (updated) => {
      updateUser(updated)
      form.reset({ name: updated.name, headline: updated.headline ?? '', bio: updated.bio ?? '' })
      toast.success(t.common.saved)
    },
    onError: toast.error,
  })
  const { errors, isDirty } = form.formState

  return (
    <form className={s.formGrid} onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <Field label={t.profile.name} error={errors.name?.message}>
        {(id, describedBy, invalid) => <Input id={id} aria-describedby={describedBy} invalid={invalid} {...form.register('name')} />}
      </Field>
      <Field label={t.profile.headline} optional={t.common.optional} error={errors.headline?.message}>
        {(id, describedBy, invalid) => (
          <Input id={id} placeholder={t.profile.headlinePlaceholder} aria-describedby={describedBy} invalid={invalid} {...form.register('headline')} />
        )}
      </Field>
      <Field
        label={t.profile.bio}
        optional={t.common.optional}
        hint={user.role === 'Teacher' ? t.profile.bioHint : undefined}
        error={errors.bio?.message}
      >
        {(id, describedBy, invalid) => <Textarea id={id} rows={4} aria-describedby={describedBy} invalid={invalid} {...form.register('bio')} />}
      </Field>
      <div className={s.formActions}>
        <Button type="submit" variant="primary" disabled={!isDirty} loading={save.isPending}>
          {t.common.save}
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { t } = useI18n()
  const toast = useToast()
  const schema = useMemo(
    () => z.object({ currentPassword: z.string().min(1, t.validation.required), newPassword: passwordSchema(t) }),
    [t],
  )
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '' } })
  const change = useMutation({
    mutationFn: (values: Values) => api.put('/auth/me/password', values),
    onSuccess: () => {
      form.reset()
      toast.success(t.profile.passwordChanged)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors.currentPassword) form.setError('currentPassword', { message: e.fieldErrors.currentPassword[0] })
      else if (e instanceof ApiError && e.fieldErrors.newPassword) form.setError('newPassword', { message: e.fieldErrors.newPassword[0] })
      else toast.error(e)
    },
  })
  const { errors } = form.formState

  return (
    <form className={s.formGrid} onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate>
      <div className={s.formRow}>
        <Field label={t.profile.currentPassword} error={errors.currentPassword?.message}>
          {(id, describedBy, invalid) => (
            <Input id={id} type="password" autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...form.register('currentPassword')} />
          )}
        </Field>
        <Field label={t.profile.newPassword} hint={t.auth.passwordHint} error={errors.newPassword?.message}>
          {(id, describedBy, invalid) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...form.register('newPassword')} />
          )}
        </Field>
      </div>
      <div className={s.formActions}>
        <Button type="submit" loading={change.isPending}>
          {t.profile.changePassword}
        </Button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const { t, f, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className={`${s.narrow} ${s.stack}`}>
      <PageHeader title={t.profile.title} />
      <Card>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
          <Avatar name={user.name} size={56} />
          <div>
            <p style={{ fontWeight: 650, fontSize: 'var(--text-lg)' }}>{user.name}</p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {user.email}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <Badge tone="primary">{t.roles[user.role]}</Badge>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginTop: 6 }}>
              {t.profile.memberSince(f.date(user.createdAt))}
            </p>
          </div>
        </div>
        <CardHeader title={t.profile.personal} />
        <ProfileForm user={user} />
      </Card>

      <Card>
        <CardHeader title={t.profile.preferences} />
        <div className={s.formRow}>
          <div className={s.formGrid}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 560 }}>{t.profile.language}</span>
            <Segmented<Language>
              label={t.profile.language}
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'uk', label: 'Українська' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <div className={s.formGrid}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 560 }}>{t.profile.theme}</span>
            <Segmented<Theme>
              label={t.profile.theme}
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: t.profile.themeSystem },
                { value: 'light', label: t.nav.themeLight },
                { value: 'dark', label: t.nav.themeDark },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={t.profile.password} />
        <PasswordForm />
      </Card>
    </div>
  )
}
