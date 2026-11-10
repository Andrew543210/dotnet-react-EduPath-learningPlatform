import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { configureApi } from '@/api/client'
import { readStorage, writeStorage } from '@/lib/storage'
import { en } from './en'
import { uk, type Messages } from './uk'

export type Language = 'uk' | 'en'

const dictionaries: Record<Language, Messages> = { uk, en }
const locales: Record<Language, string> = { uk: 'uk-UA', en: 'en-GB' }
const STORAGE_KEY = 'edupath.language'

function initialLanguage(): Language {
  const saved = readStorage(STORAGE_KEY)
  if (saved === 'uk' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'uk'
}

export interface Formatters {
  money: (amount: number) => string
  date: (iso: string) => string
  dateTime: (iso: string) => string
  shortDate: (iso: string) => string
  relative: (iso: string) => string
  number: (n: number) => string
  rating: (n: number | null) => string
}

function createFormatters(language: Language): Formatters {
  const locale = locales[language]
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'UAH', maximumFractionDigits: 0, currencyDisplay: language === 'uk' ? 'symbol' : 'code' })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const dateTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const number = new Intl.NumberFormat(locale)
  const rating = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return {
    money: (amount) => money.format(amount),
    date: (iso) => date.format(new Date(iso)),
    dateTime: (iso) => dateTime.format(new Date(iso)),
    shortDate: (iso) => shortDate.format(new Date(iso)),
    number: (n) => number.format(n),
    rating: (n) => (n === null ? '—' : rating.format(n)),
    relative: (iso) => {
      const seconds = (new Date(iso).getTime() - Date.now()) / 1000
      const abs = Math.abs(seconds)
      if (abs < 60) return relative.format(Math.round(seconds), 'second')
      if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
      if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
      if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day')
      return date.format(new Date(iso))
    },
  }
}

interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Messages
  f: Formatters
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children, language: forced }: { children: ReactNode; language?: Language }) {
  const [language, setLanguageState] = useState<Language>(forced ?? initialLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    writeStorage(STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    configureApi({ language: () => language })
  }, [language])

  configureApi({ language: () => language })

  const value = useMemo(
    () => ({ language, setLanguage, t: dictionaries[language], f: createFormatters(language) }),
    [language, setLanguage],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
