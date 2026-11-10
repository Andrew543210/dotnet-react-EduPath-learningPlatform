import clsx from 'clsx'
import { Award, BookOpen, CreditCard, LogOut, Menu, Moon, Sun, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink, Segmented } from '@/ui/controls'
import { Avatar } from '@/ui/display'
import { Dropdown, overlayStyles as o, useToast } from '@/ui/overlay'
import { useTheme } from '../ThemeProvider'
import s from './Layout.module.css'

export function Logo() {
  return (
    <Link to="/" className={s.logo} aria-label="EduPath">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M8 23h5v-5h5v-5h6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="9" r="3" fill="var(--accent)" />
      </svg>
      <span>EduPath</span>
    </Link>
  )
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n()
  return (
    <Segmented
      label={t.nav.language}
      value={language}
      onChange={setLanguage}
      options={[
        { value: 'uk', label: 'UK', title: 'Українська' },
        { value: 'en', label: 'EN', title: 'English' },
      ]}
    />
  )
}

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const { t } = useI18n()
  const label = resolved === 'dark' ? t.nav.themeLight : t.nav.themeDark
  return (
    <button type="button" className={s.iconButton} onClick={toggle} aria-label={label} title={label}>
      {resolved === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <Dropdown
      label={t.nav.profile}
      trigger={({ toggle, open }) => (
        <button type="button" className={s.userButton} onClick={toggle} aria-expanded={open} aria-label={user.name}>
          <Avatar name={user.name} size={34} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className={s.userHead}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className={s.roleTag}>{t.roles[user.role]}</span>
          </div>
          <div className={o.menuSeparator} />
          <Link className={o.menuItem} to="/profile" onClick={close}>
            <UserRound aria-hidden />
            {t.nav.profile}
          </Link>
          {user.role === 'Student' && (
            <>
              <Link className={o.menuItem} to="/certificates" onClick={close}>
                <Award aria-hidden />
                {t.nav.certificates}
              </Link>
              <Link className={o.menuItem} to="/payments" onClick={close}>
                <CreditCard aria-hidden />
                {t.nav.payments}
              </Link>
            </>
          )}
          <div className={o.menuSeparator} />
          <button
            type="button"
            className={o.menuItem}
            onClick={() => {
              close()
              logout()
              toast.info(t.auth.signedOut)
              navigate('/')
            }}
          >
            <LogOut aria-hidden />
            {t.nav.signOut}
          </button>
        </>
      )}
    </Dropdown>
  )
}

export function Header() {
  const { user } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [location.pathname])

  const links = [{ to: '/catalog', label: t.nav.catalog }]
  if (user?.role === 'Student') links.push({ to: '/learn', label: t.nav.myLearning }, { to: '/certificates', label: t.nav.certificates })
  if (user?.role === 'Teacher') links.push({ to: '/teach', label: t.nav.teaching })
  if (user?.role === 'Admin') links.push({ to: '/admin', label: t.nav.admin }, { to: '/teach', label: t.nav.teaching })

  return (
    <header className={s.header}>
      <div className={clsx('container', s.headerInner)}>
        <Logo />
        <nav className={clsx(s.nav, menuOpen && s.navOpen)} aria-label={t.nav.menu}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => clsx(s.navLink, isActive && s.navActive)}>
              {l.label}
            </NavLink>
          ))}
          <div className={s.navMobileExtras}>
            <LanguageSwitch />
            {!user && (
              <div className={s.navAuth}>
                <ButtonLink to="/login">{t.nav.signIn}</ButtonLink>
                <ButtonLink to="/register" variant="primary">
                  {t.nav.signUp}
                </ButtonLink>
              </div>
            )}
          </div>
        </nav>
        <div className={s.headerActions}>
          <div className={s.desktopOnly}>
            <LanguageSwitch />
          </div>
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" className={s.desktopOnly}>
                {t.nav.signIn}
              </ButtonLink>
              <ButtonLink to="/register" variant="primary" icon={<BookOpen aria-hidden />} className={s.signUp}>
                {t.nav.signUp}
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className={clsx(s.iconButton, s.menuToggle)}
            aria-expanded={menuOpen}
            aria-label={t.nav.menu}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  )
}

