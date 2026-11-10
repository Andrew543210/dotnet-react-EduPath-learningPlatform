import clsx from 'clsx'
import { Bell, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from './controls'
import s from './overlay.module.css'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={clsx(s.dialog, wide && s.wide)}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className={s.head}>
            <div>
              <h2 className={s.title}>{title}</h2>
              {description && <p className={s.description}>{description}</p>}
            </div>
            <Button variant="ghost" size="sm" iconOnly aria-label={t.common.close} onClick={onClose} icon={<X />} />
          </div>
          <div className={s.body}>{children}</div>
          {footer && <div className={s.foot}>{footer}</div>}
        </>
      )}
    </dialog>
  )
}

interface ConfirmOptions {
  title: ReactNode
  text?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => new Promise((resolve) => setState({ ...options, resolve })), [])

  const finish = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => finish(false)}
        title={state?.title}
        footer={
          <>
            <Button onClick={() => finish(false)}>{t.common.cancel}</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => finish(true)} autoFocus>
              {state?.confirmLabel ?? t.common.confirm}
            </Button>
          </>
        }
      >
        {state?.text && <p className="muted">{state.text}</p>}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const value = useContext(ConfirmContext)
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider')
  return value
}

type ToastTone = 'info' | 'success' | 'error' | 'notification'

interface Toast {
  id: number
  tone: ToastTone
  title?: string
  message: string
  link?: string | null
}

interface ToastApi {
  show: (toast: Omit<Toast, 'id'>) => void
  success: (message: string) => void
  error: (error: unknown) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const toastIcons = { info: Info, success: CheckCircle2, error: XCircle, notification: Bell }

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.tone === 'error' ? 7000 : 5000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show({ tone: 'success', message }),
      info: (message) => show({ tone: 'info', message }),
      error: (error) => show({ tone: 'error', message: error instanceof Error ? error.message : String(error) }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={s.toasts} aria-live="polite" role="region" aria-label={t.notifications.title}>
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.tone]
          return (
            <div key={toast.id} className={clsx(s.toast, s[`toast-${toast.tone}`])} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden />
              <div className={s.toastBody}>
                {toast.title && <p className={s.toastTitle}>{toast.title}</p>}
                <p>{toast.message}</p>
                {toast.link && (
                  <Link className={s.toastLink} to={toast.link} onClick={() => dismiss(toast.id)}>
                    {t.common.open}
                  </Link>
                )}
              </div>
              <button type="button" className={s.toastClose} aria-label={t.common.close} onClick={() => dismiss(toast.id)}>
                <X />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}

export function Dropdown({
  trigger,
  children,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={s.menuWrap} ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className={s.menu} role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export { s as overlayStyles }
