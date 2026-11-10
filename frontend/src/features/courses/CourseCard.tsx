import { Clock, Users } from 'lucide-react'
import { Link } from 'react-router'
import type { CourseCard as CourseCardDto } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { CourseCover, Stars } from '@/ui/display'
import s from './CourseCard.module.css'

export function CourseCard({ course }: { course: CourseCardDto }) {
  const { t, f } = useI18n()
  return (
    <article className={s.card}>
      <CourseCover trail={course.trail} seed={course.id} height={112} />
      <div className={s.body}>
        <p className={s.category}>
          {course.categoryName}, {t.levels[course.level].toLowerCase()}
        </p>
        <h3 className={s.title}>
          <Link to={`/courses/${course.id}`} className={s.link}>
            {course.title}
          </Link>
        </h3>
        <p className={s.summary}>{course.summary}</p>
        <p className={s.teacher}>{course.teacherName}</p>
        <div className={s.meta}>
          <Stars value={course.rating} count={course.reviewCount} compact />
          <span className={s.metaItem}>
            <Clock aria-hidden />
            {t.common.duration(course.durationMinutes)}
          </span>
          <span className={s.metaItem}>
            <Users aria-hidden />
            {f.number(course.studentCount)}
          </span>
        </div>
      </div>
      <div className={s.foot}>
        <span className={s.lessons}>{t.common.lessons(course.lessonCount)}</span>
        <span className={course.price === 0 ? s.free : s.price}>{course.price === 0 ? t.common.free : f.money(course.price)}</span>
      </div>
    </article>
  )
}

export function CourseGrid({ courses }: { courses: CourseCardDto[] }) {
  return (
    <div className={s.grid}>
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  )
}
