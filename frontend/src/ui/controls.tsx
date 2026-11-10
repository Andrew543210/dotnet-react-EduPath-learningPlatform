import clsx from 'clsx'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router'
import s from './controls.module.css'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonOwnProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
  icon?: ReactNode
  iconOnly?: boolean
}

export function buttonClass({ variant = 'secondary', size = 'md', block, iconOnly }: ButtonOwnProps = {}) {
  return clsx(s.button, s[variant], size !== 'md' && s[size], block && s.block, iconOnly && s.iconOnly)
}

export const Button = forwardRef<HTMLButtonElement, ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ variant, size, loading, block, icon, iconOnly, className, children, disabled, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(buttonClass({ variant, size, block, iconOnly }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span className={s.spinner} aria-hidden /> : icon}
        {children}
      </button>
    )
  },
)

export function ButtonLink({
  to,
  variant,
  size,
  block,
  icon,
  children,
  className,
  external,
}: ButtonOwnProps & { to: string; children?: ReactNode; className?: string; external?: boolean }) {
  const cls = clsx(buttonClass({ variant, size, block }), className)
  if (external)
    return (
      <a className={cls} href={to} target="_blank" rel="noreferrer">
        {icon}
        {children}
      </a>
    )
  return (
    <Link className={cls} to={to}>
      {icon}
      {children}
    </Link>
  )
}

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: string
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode
  className?: string
}

export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={clsx(s.field, className)}>
      {label && (
        <label className={s.label} htmlFor={id}>
          {label}
          {optional && <span className={s.labelOptional}>{optional}</span>}
        </label>
      )}
      {children(id, describedBy, Boolean(error))}
      {hint && !error && (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className={s.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode; mono?: boolean }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, icon, mono, className, ...rest }, ref) {
  const input = (
    <input
      ref={ref}
      className={clsx(s.input, invalid && s.invalid, mono && s.mono, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
  if (!icon) return input
  return (
    <div className={s.inputWrap}>
      {icon}
      {input}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; mono?: boolean }>(
  function Textarea({ invalid, mono, className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(s.textarea, invalid && s.invalid, mono && s.mono, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ invalid, className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={clsx(s.select, invalid && s.invalid, className)} aria-invalid={invalid || undefined} {...rest}>
        {children}
      </select>
    )
  },
)

export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={s.switchRow}>
      <span className={s.field}>
        <span className={s.label}>{label}</span>
        {hint && <span className={s.hint}>{hint}</span>}
      </span>
      <span className={s.switch}>
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className={s.switchTrack} />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className={s.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={s.segment}
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const Choice = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }>(
  function Choice({ children, className, ...input }, ref) {
    return (
      <label className={clsx(s.choice, className)}>
        <input ref={ref} {...input} />
        <span>{children}</span>
      </label>
    )
  },
)

export { s as controlStyles }
