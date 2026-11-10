import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { api } from '@/api/client'
import type { TeacherProfile } from '@/api/types'
import { CourseGrid } from '@/features/courses/CourseCard'
import { useI18n } from '@/i18n/I18nProvider'
import { Avatar, Card, ErrorState, Loader } from '@/ui/display'
import s from './AuthPages.module.css'

export default function TeacherPage() {
  const id = Number(useParams().id)
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['teacher', id], queryFn: () => api.get<TeacherProfile>(`/teachers/${id}`) })

  if (query.isPending) return <Loader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const { teacher, courses } = query.data

  return (
    <div className={s.stack}>
      <Card className={s.profile}>
        <Avatar name={teacher.name} size={80} />
        <div className={s.profileText}>
          <p className={s.profileRole}>{t.course.teacher}</p>
          <h1 className={s.profileName}>{teacher.name}</h1>
          {teacher.headline && <p className="muted">{teacher.headline}</p>}
          <p className={s.profileStats}>{t.course.teacherStats(teacher.courseCount, teacher.studentCount)}</p>
          {teacher.bio && <p className={s.profileBio}>{teacher.bio}</p>}
        </div>
      </Card>
      <section>
        <h2 className={s.sectionTitle}>{t.course.otherCourses}</h2>
        <CourseGrid courses={courses} />
      </section>
    </div>
  )
}
