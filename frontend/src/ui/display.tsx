import clsx from 'clsx'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Code2,
  Info,
  Megaphone,
  Palette,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { TrailColor } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from './controls'
import s from './display.module.css'

export function Card({ children, className, padded = true, as: As = 'section' }: { children: ReactNode; className?: string; padded?: boolean; as?: 'section' | 'div' | 'article' }) {
  return <As className={clsx(s.card, padded && s.padded, className)}>{children}</As>
}

export function CardHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.cardHeader}>
      <div>
        <h2 className={s.cardTitle}>{title}</h2>
        {hint && <p className={s.cardHint}>{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={clsx(s.badge, tone !== 'neutral' && s[`tone-${tone}`])}>
      {icon}
      {children}
    </span>
  )
}

export function ProgressBar({ value, label, thin, showValue }: { value: number; label?: ReactNode; thin?: boolean; showValue?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div>
      {(label || showValue) && (
        <div className={s.progressLabel}>
          <span>{label}</span>
          {showValue && <span className="tabular">{pct}%</span>}
        </div>
      )}
      <div className={clsx(s.progress, thin && s.progressThin)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx(s.progressBar, pct === 100 && s.progressDone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Stars({ value, count, compact }: { value: number | null; count?: number; compact?: boolean }) {
  const { t, f } = useI18n()
  if (value === null)
    return <span className={s.stars}>{t.course.noRating}</span>
  const rounded = Math.round(value)
  return (
    <span className={s.stars} aria-label={t.reviews.stars(Number(value.toFixed(1)))}>
      {!compact && (
        <span className={s.starsIcons} aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={i <= rounded ? s.starOn : s.starOff} />
          ))}
        </span>
      )}
      {compact && <Star className={s.starOn} width={15} height={15} aria-hidden />}
      <span className={s.ratingValue}>{f.rating(value)}</span>
      {count !== undefined && <span>({count})</span>}
    </span>
  )
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const { t } = useI18n()
  return (
    <div className={s.starInput} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={t.reviews.stars(i)}
          className={s.starButton}
          onClick={() => onChange(i)}
        >
          <Star className={i <= value ? s.starOn : s.starOff} />
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon = Info,
  title,
  text,
  action,
  heading,
}: {
  icon?: LucideIcon
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  heading?: boolean
}) {
  const Title = heading ? 'h1' : 'p'
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <Icon aria-hidden />
      </span>
      <Title className={s.emptyTitle}>{title}</Title>
      {text && <p className={s.emptyText}>{text}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  )
}

export function Loader({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className={s.loader} role="status" aria-live="polite">
      <span className={s.loaderDot} aria-hidden />
      <span className="visually-hidden">{label ?? t.common.loading}</span>
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', className }: { height?: number; width?: number | string; className?: string }) {
  return <div className={clsx(s.skeleton, className)} style={{ height, width }} aria-hidden />
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t.common.errorTitle}
      text={error instanceof Error ? error.message : undefined}
      action={onRetry && <Button onClick={onRetry}>{t.common.retry}</Button>}
    />
  )
}

export function StatTile({ label, value, hint, icon: Icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <Card padded={false} className={s.stat}>
      <span className={s.statLabel}>
        {Icon && <Icon aria-hidden />}
        {label}
      </span>
      <span className={s.statValue}>{value}</span>
      {hint && <span className={s.statHint}>{hint}</span>}
    </Card>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={s.statGrid}>{children}</div>
}

const avatarColors = ['#116d63', '#2f62c9', '#cf543e', '#7a5bd0', '#b7791f', '#1f8a5b', '#c2417a', '#4b6584']

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return (
    <span
      className={s.avatar}
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColors[hash % avatarColors.length] }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className={s.pageHeader}>
      <div>
        {back && (
          <Link to={back.to} className={s.backLink}>
            <ArrowLeft aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle && <p className={s.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={s.pageActions}>{actions}</div>}
    </header>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: ReactNode; count?: number }[]
  label: string
}) {
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={s.tab}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span className={s.tabCount}>{item.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const { t } = useI18n()
  if (totalPages <= 1) return null
  return (
    <nav className={s.pagination} aria-label={t.common.page(page, totalPages)}>
      <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t.common.prev}
      </Button>
      <span className="tabular">{t.common.page(page, totalPages)}</span>
      <Button size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t.common.next}
      </Button>
    </nav>
  )
}

const trailIcons: Record<TrailColor, LucideIcon> = { Blue: Code2, Red: Palette, Green: BarChart3, Yellow: Megaphone }

export function trailClass(trail: TrailColor) {
  return s[`trail-${trail}`]
}

export function TrailDot({ trail }: { trail: TrailColor }) {
  return <span className={clsx(s.trailDot, trailClass(trail))} aria-hidden />
}

export function CourseCover({ trail, seed, height = 132, className }: { trail: TrailColor; seed: number; height?: number; className?: string }) {
  const Icon = trailIcons[trail]
  const variant = seed % 3
  const shift = (seed * 37) % 60
  return (
    <div className={clsx(s.cover, trailClass(trail), className)} style={{ height }} aria-hidden>
      <svg className={s.coverArt} viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice">
        {variant === 0 && (
          <>
            <circle cx={250 - shift / 2} cy={30} r={72} fill="currentColor" opacity="0.08" />
            <circle cx={300 - shift} cy={120} r={44} fill="currentColor" opacity="0.1" />
          </>
        )}
        {variant === 1 && (
          <>
            <rect x={170 + shift / 3} y={-30} width={120} height={120} rx={28} transform={`rotate(18 230 30)`} fill="currentColor" opacity="0.09" />
            <rect x={240} y={70 - shift / 4} width={90} height={90} rx={22} transform="rotate(-12 285 115)" fill="currentColor" opacity="0.07" />
          </>
        )}
        {variant === 2 && (
          <g fill="none" stroke="currentColor" strokeWidth="10" opacity="0.1">
            <path d={`M150 ${150 - shift / 3} C 210 60, 250 120, 330 ${20 + shift / 2}`} />
            <path d={`M190 160 C 240 100, 280 140, 340 ${70 + shift / 3}`} />
          </g>
        )}
      </svg>
      <span className={s.coverIcon}>
        <Icon />
      </span>
    </div>
  )
}

type CalloutTone = 'info' | 'warning' | 'success' | 'danger'
const calloutIcons: Record<CalloutTone, LucideIcon> = { info: Info, warning: AlertTriangle, success: CheckCircle2, danger: XCircle }

export function Callout({ tone = 'info', title, children }: { tone?: CalloutTone; title?: ReactNode; children?: ReactNode }) {
  const Icon = calloutIcons[tone]
  return (
    <div className={clsx(s.callout, tone !== 'info' && s[`callout-${tone}`])} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon aria-hidden />
      <div>
        {title && <p className={s.calloutTitle}>{title}</p>}
        {children}
      </div>
    </div>
  )
}

export { s as displayStyles }
