import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { api, ApiError } from '@/api/client'
import type { PublicSettings } from '@/api/types'
import { homeFor, useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { passwordSchema } from '@/lib/validation'
import { Button, Choice, Field, Input } from '@/ui/controls'
import { Callout, Card } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import s from './AuthPages.module.css'

export default function RegisterPage() {
  const { t } = useI18n()
  const { register: signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const settings = useQuery({ queryKey: ['settings', 'public'], queryFn: () => api.get<PublicSettings>('/settings/public') })
  const teachersAllowed = settings.data?.allowTeacherRegistration ?? true

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t.validation.required).max(100, t.validation.max(100)),
        email: z.string().trim().min(1, t.validation.required).email(t.validation.email),
        password: passwordSchema(t),
        role: z.enum(['Student', 'Teacher']),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: params.get('role') === 'Teacher' ? 'Teacher' : 'Student' },
  })
  const { errors, isSubmitting } = form.formState
  const role = form.watch('role')

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await signUp(values)
      toast.success(t.auth.welcome(user.name.split(' ')[0]))
      navigate(homeFor(user.role), { replace: true })
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          if (field in values) form.setError(field as keyof Values, { message: messages[0] })
        }
        return
      }
      setError(e instanceof Error ? e.message : String(e))
    }
  })

  return (
    <div className={s.authLayout}>
      <Card className={s.authCard}>
        <h1 className={s.authTitle}>{t.auth.registerTitle}</h1>
        <p className={s.authSubtitle}>{t.auth.registerSubtitle}</p>
        <form className={s.form} onSubmit={onSubmit} noValidate>
          {error && <Callout tone="danger">{error}</Callout>}

          <fieldset className={s.roles}>
            <legend className={s.legend}>{t.auth.role}</legend>
            <Choice type="radio" value="Student" {...form.register('role')}>
              <strong>{t.auth.roleStudent}</strong>
              <span className={s.choiceHint}>{t.auth.roleStudentHint}</span>
            </Choice>
            <Choice type="radio" value="Teacher" disabled={!teachersAllowed} {...form.register('role')}>
              <strong>{t.auth.roleTeacher}</strong>
              <span className={s.choiceHint}>{teachersAllowed ? t.auth.roleTeacherHint : t.auth.teacherClosed}</span>
            </Choice>
          </fieldset>
          {!teachersAllowed && role === 'Teacher' && <Callout tone="warning">{t.auth.teacherClosed}</Callout>}

          <Field label={t.auth.name} error={errors.name?.message}>
            {(id, describedBy, invalid) => (
              <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...form.register('name')} />
            )}
          </Field>
          <Field label={t.auth.email} error={errors.email?.message}>
            {(id, describedBy, invalid) => (
              <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} {...form.register('email')} />
            )}
          </Field>
          <Field label={t.auth.password} hint={t.auth.passwordHint} error={errors.password?.message}>
            {(id, describedBy, invalid) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                aria-describedby={describedBy}
                invalid={invalid}
                {...form.register('password')}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
            {t.auth.registerSubmit}
          </Button>
        </form>
        <p className={s.switch}>
          {t.auth.haveAccount} <Link to="/login">{t.nav.signIn}</Link>
        </p>
      </Card>
    </div>
  )
}
