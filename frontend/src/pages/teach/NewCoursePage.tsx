import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '@/api/client'
import type { CourseEditor } from '@/api/types'
import { CourseDetailsForm, emptyCourse } from '@/features/teaching/CourseDetailsForm'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, PageHeader } from '@/ui/display'
import { useToast } from '@/ui/overlay'

export default function NewCoursePage() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <>
      <PageHeader title={t.teach.createTitle} subtitle={t.teach.createSubtitle} back={{ to: '/teach/courses', label: t.teach.courses }} />
      <Card>
        <CourseDetailsForm
          initial={emptyCourse}
          submitLabel={t.common.create}
          onSubmit={async (payload) => {
            try {
              const course = await api.post<CourseEditor>('/teach/courses', payload)
              queryClient.invalidateQueries({ queryKey: ['teach'] })
              toast.success(t.teach.created)
              navigate(`/teach/courses/${course.id}?tab=program`, { replace: true })
            } catch (e) {
              toast.error(e)
              throw e
            }
          }}
        />
      </Card>
    </>
  )
}
