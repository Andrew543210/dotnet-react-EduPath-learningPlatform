import { useQuery } from '@tanstack/react-query'
import { Check, ClipboardCheck, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '@/api/client'
import type { Category, CourseCard, PagedResult } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { CourseGrid } from '@/features/courses/CourseCard'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, ButtonLink, Input } from '@/ui/controls'
import { Skeleton, TrailDot } from '@/ui/display'
import s from './HomePage.module.css'

function RoutePreview() {
  const { t } = useI18n()
  const done = 3
  return (
    <div className={s.preview} aria-hidden>
      <div className={s.previewHead}>
        <span className={s.previewCourse}>{t.home.previewCourse}</span>
        <span className={s.previewProgress}>{t.home.previewProgress}</span>
        <div className={s.previewBar}>
          <span style={{ width: '50%' }} />
        </div>
      </div>
      <ol className={s.route}>
        {t.home.previewLessons.map((title, i) => (
          <li key={title} className={i < done ? s.stopDone : i === done ? s.stopCurrent : s.stop}>
            <span className={s.stopMark}>{i < done ? <Check /> : i + 1}</span>
            <span className={s.stopTitle}>{title}</span>
            {i === done && (
              <span className={s.stopTest}>
                <ClipboardCheck />
                {t.home.previewTest}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function HomePage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') })
  const popular = useQuery({
    queryKey: ['courses', 'popular'],
    queryFn: () => api.get<PagedResult<CourseCard>>('/courses', { sort: 'Popular', pageSize: 4 }),
  })

  return (
    <>
      <section className={s.hero}>
        <div className={`container ${s.heroInner}`}>
          <div className={s.heroText}>
            <h1 className={s.title}>{t.home.title}</h1>
            <p className={s.subtitle}>{t.home.subtitle}</p>
            <form
              className={s.search}
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                navigate(`/catalog${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`)
              }}
            >
              <Input
                icon={<Search aria-hidden />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.home.searchPlaceholder}
                aria-label={t.common.search}
              />
              <Button type="submit" variant="primary" size="lg">
                {t.common.search}
              </Button>
            </form>
            {popular.data && (
              <p className={s.heroNote}>
                <Link to="/catalog">{t.catalog.results(popular.data.totalCount)}</Link>
              </p>
            )}
          </div>
          <RoutePreview />
        </div>
      </section>

      <div className={`container ${s.body}`}>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>{t.home.categories}</h2>
          </div>
          <div className={s.categories}>
            {categories.isPending
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={92} />)
              : categories.data?.map((c) => (
                  <Link key={c.id} to={`/catalog?categoryId=${c.id}`} className={s.category}>
                    <span className={s.categoryName}>
                      <TrailDot trail={c.trail} />
                      {c.name}
                    </span>
                    <span className={s.categoryText}>{c.description}</span>
                    <span className={s.categoryCount}>{t.common.courses(c.courseCount)}</span>
                  </Link>
                ))}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>{t.home.popular}</h2>
            <Link to="/catalog">{t.common.viewAll}</Link>
          </div>
          {popular.isPending ? (
            <div className={s.categories}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height={300} />
              ))}
            </div>
          ) : (
            <CourseGrid courses={popular.data?.items ?? []} />
          )}
        </section>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>{t.home.howTitle}</h2>
          </div>
          <ol className={s.steps}>
            {t.home.steps.map((step, i) => (
              <li key={step.title} className={s.step}>
                <span className={s.stepNumber}>{i + 1}</span>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {!user && (
          <section className={s.teach}>
            <div>
              <h2 className={s.teachTitle}>{t.home.teacherTitle}</h2>
              <p className={s.teachText}>{t.home.teacherText}</p>
            </div>
            <ButtonLink to="/register?role=Teacher" variant="primary" size="lg">
              {t.home.teacherCta}
            </ButtonLink>
          </section>
        )}
      </div>
    </>
  )
}
