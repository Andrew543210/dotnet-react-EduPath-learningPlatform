import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { homeFor, useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Field, Input } from '@/ui/controls'
import { Callout, Card } from '@/ui/display'
import { useToast } from '@/ui/overlay'
import s from './AuthPages.module.css'

export default function LoginPage() {
  const { t } = useI18n()
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, t.validation.required).email(t.validation.email),
        password: z.string().min(1, t.validation.required),
      }),
    [t],
  )
  type Values = z.infer<typeof schema>

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await login(values.email, values.password)
      toast.success(t.auth.welcome(user.name.split(' ')[0]))
      const next = params.get('next')
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(user.role), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  })

  return (
    <div className={s.authLayout}>
      <Card className={s.authCard}>
        <h1 className={s.authTitle}>{t.auth.loginTitle}</h1>
        <p className={s.authSubtitle}>{t.auth.loginSubtitle}</p>
        <form className={s.form} onSubmit={onSubmit} noValidate>
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label={t.auth.email} error={errors.email?.message}>
            {(id, describedBy, invalid) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                icon={<Mail aria-hidden />}
                aria-describedby={describedBy}
                invalid={invalid}
                {...form.register('email')}
              />
            )}
          </Field>
          <Field label={t.auth.password} error={errors.password?.message}>
            {(id, describedBy, invalid) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                icon={<KeyRound aria-hidden />}
                aria-describedby={describedBy}
                invalid={invalid}
                {...form.register('password')}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
            {t.auth.loginSubmit}
          </Button>
        </form>
        <p className={s.switch}>
          {t.auth.noAccount} <Link to="/register">{t.nav.signUp}</Link>
        </p>
      </Card>
    </div>
  )
}
