import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { AuthProvider } from '@/auth/AuthProvider'
import { I18nProvider, type Language } from '@/i18n/I18nProvider'
import { ThemeProvider } from './ThemeProvider'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  })
}

export function Providers({ children, language, client }: { children: ReactNode; language?: Language; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider language={language}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
