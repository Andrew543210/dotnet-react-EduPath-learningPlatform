import { screen } from '@testing-library/react'
import { CourseCard } from './CourseCard'
import type { CourseCard as CourseCardDto } from '@/api/types'
import { renderPage } from '@/test/render'

const course: CourseCardDto = {
  id: 6,
  title: 'SQL для аналітиків',
  summary: 'Запити до реальної бази',
  price: 450,
  level: 'Beginner',
  status: 'Published',
  categoryId: 1,
  categoryName: 'Аналітика даних',
  trail: 'Green',
  teacherId: 3,
  teacherName: 'Тарас Гнатюк',
  lessonCount: 6,
  durationMinutes: 109,
  studentCount: 10,
  rating: 4.3,
  reviewCount: 4,
  publishedAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}

describe('CourseCard', () => {
  it('links to the course and shows its facts', () => {
    renderPage(<CourseCard course={course} />)
    expect(screen.getByRole('link', { name: 'SQL для аналітиків' })).toHaveAttribute('href', '/courses/6')
    expect(screen.getByText('Тарас Гнатюк')).toBeInTheDocument()
    expect(screen.getByText('6 уроків')).toBeInTheDocument()
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('labels free courses and translates the level', () => {
    renderPage(<CourseCard course={{ ...course, price: 0, level: 'Advanced' }} />, { language: 'en' })
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Аналітика даних, advanced')).toBeInTheDocument()
    expect(screen.getByText('6 lessons')).toBeInTheDocument()
  })
})
