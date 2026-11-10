import { Compass, Lock, RefreshCw } from 'lucide-react'
import { useRouteError } from 'react-router'
import { homeFor, useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink } from '@/ui/controls'
import { Card, EmptyState } from '@/ui/display'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <Card>
      <EmptyState
          heading
        icon={Compass}
        title={t.errors.notFoundTitle}
        text={t.errors.notFoundText}
        action={
          <ButtonLink to="/catalog" variant="primary">
            {t.nav.toCatalog}
          </ButtonLink>
        }
      />
    </Card>
  )
}

export function ForbiddenPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  return (
    <div className="container" style={{ paddingBlock: 48 }}>
      <Card>
        <EmptyState
          heading
          icon={Lock}
          title={t.errors.forbiddenTitle}
          text={t.errors.forbiddenText}
          action={
            <ButtonLink to={homeFor(user?.role)} variant="primary">
              {t.errors.myArea}
            </ButtonLink>
          }
        />
      </Card>
    </div>
  )
}

export function RouteErrorPage() {
  const error = useRouteError()
  const { t } = useI18n()
  return (
    <div className="container" style={{ paddingBlock: 64 }}>
      <Card>
        <EmptyState
          heading
          icon={RefreshCw}
          title={t.common.errorTitle}
          text={error instanceof Error ? error.message : undefined}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              {t.common.retry}
            </Button>
          }
        />
      </Card>
    </div>
  )
}
