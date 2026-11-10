import { useQuery } from '@tanstack/react-query'
import { BookPlus, Plus } from 'lucide-react'
import { api } from '@/api/client'
import type { CourseCard } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { ButtonLink } from '@/ui/controls'
import { CourseTable } from '@/features/teaching/CourseTable'
import { Card, EmptyState, ErrorState, Loader, PageHeader } from '@/ui/display'

export default function TeachCoursesPage() {
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['teach', 'courses'], queryFn: () => api.get<CourseCard[]>('/teach/courses') })

  return (
    <>
      <PageHeader
        title={t.teach.coursesTitle}
        subtitle={t.teach.coursesSubtitle}
        actions={
          <ButtonLink to="/teach/courses/new" variant="primary" icon={<Plus aria-hidden />}>
            {t.teach.newCourse}
          </ButtonLink>
        }
      />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookPlus}
            title={t.teach.emptyTitle}
            text={t.teach.emptyText}
            action={
              <ButtonLink to="/teach/courses/new" variant="primary">
                {t.teach.newCourse}
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <CourseTable courses={query.data} />
        </Card>
      )}
    </>
  )
}
