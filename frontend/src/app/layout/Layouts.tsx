import clsx from 'clsx'
import {
  BarChart3,
  BookOpenCheck,
  FolderTree,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { useRealtimeNotifications } from '@/features/notifications/useRealtimeNotifications'
import { useI18n } from '@/i18n/I18nProvider'
import { ConfirmProvider, ToastProvider } from '@/ui/overlay'
import { Header, Logo } from './Header'
import s from './Layout.module.css'

export function RouteRoot() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Outlet />
      </ConfirmProvider>
    </ToastProvider>
  )
}

function Footer() {
  const { t } = useI18n()
  return (
    <footer className={clsx(s.footer, 'no-print')}>
      <div className={clsx('container', s.footerInner)}>
        <div>
          <Logo />
          <p className={s.footerText}>{t.footer.tagline}</p>
        </div>
        <nav className={s.footerLinks}>
          <Link to="/catalog">{t.nav.catalog}</Link>
          <Link to="/verify">{t.footer.verify}</Link>
          <span className={s.footerNote}>{t.footer.sandbox}</span>
        </nav>
      </div>
    </footer>
  )
}

function Shell({ children }: { children: ReactNode }) {
  useRealtimeNotifications()
  const { t } = useI18n()
  return (
    <div className={s.shell}>
      <a href="#main" className={s.skip}>
        {t.nav.skip}
      </a>
      <Header />
      {children}
      <ScrollRestoration />
    </div>
  )
}

export function SiteLayout() {
  return (
    <Shell>
      <main id="main" className={s.main}>
        <Outlet />
      </main>
      <Footer />
    </Shell>
  )
}

export function BareLayout() {
  return (
    <Shell>
      <main id="main" className={s.bare}>
        <Outlet />
      </main>
      <Footer />
    </Shell>
  )
}

interface SideLink {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

function Workspace({ title, links }: { title: string; links: SideLink[] }) {
  return (
    <Shell>
      <div className={clsx('container', s.workspace)}>
        <aside className={s.sidebar}>
          <p className={s.sidebarTitle}>{title}</p>
          <nav className={s.sideNav} aria-label={title}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => clsx(s.sideLink, isActive && s.sideActive)}>
                <l.icon aria-hidden />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main id="main" className={s.workspaceMain}>
          <Outlet />
        </main>
      </div>
    </Shell>
  )
}

export function TeachLayout() {
  const { t } = useI18n()
  return (
    <Workspace
      title={t.nav.teaching}
      links={[
        { to: '/teach', label: t.teach.overview, icon: LayoutDashboard, end: true },
        { to: '/teach/courses', label: t.teach.courses, icon: BookOpenCheck, end: true },
        { to: '/teach/courses/new', label: t.teach.newCourse, icon: Plus },
      ]}
    />
  )
}

export function AdminLayout() {
  const { t } = useI18n()
  return (
    <Workspace
      title={t.nav.admin}
      links={[
        { to: '/admin', label: t.admin.overview, icon: BarChart3, end: true },
        { to: '/admin/moderation', label: t.admin.moderation, icon: ShieldCheck },
        { to: '/admin/users', label: t.admin.users, icon: Users },
        { to: '/admin/categories', label: t.admin.categories, icon: FolderTree },
        { to: '/admin/reviews', label: t.admin.reviews, icon: MessageSquareText },
        { to: '/admin/broadcast', label: t.admin.broadcast, icon: Megaphone },
        { to: '/admin/settings', label: t.admin.settings, icon: Settings },
      ]}
    />
  )
}
