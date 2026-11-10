import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SearchX, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '@/api/client'
import type { Category, CourseCard, CourseLevel, CourseSort, PagedResult, PriceFilter } from '@/api/types'
import { CourseGrid } from '@/features/courses/CourseCard'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Input, Select } from '@/ui/controls'
import { Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, TrailDot } from '@/ui/display'
import s from './CatalogPage.module.css'

const levels: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced']
const prices: PriceFilter[] = ['Any', 'Free', 'Paid']
const sorts: CourseSort[] = ['Popular', 'Newest', 'Rating', 'PriceAsc', 'PriceDesc']

export default function CatalogPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const categoryId = params.get('categoryId') ?? ''
  const level = params.get('level') ?? ''
  const price = (params.get('price') as PriceFilter) || 'Any'
  const sort = (params.get('sort') as CourseSort) || 'Popular'
  const page = Number(params.get('page') ?? 1)

  const [text, setText] = useState(search)
  useEffect(() => setText(search), [search])

  const update = useCallback(
    (patch: Record<string, string | number | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || (k === 'price' && v === 'Any') || (k === 'sort' && v === 'Popular') || (k === 'page' && v === 1)) next.delete(k)
            else next.set(k, String(v))
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    if (text === search) return
    const id = window.setTimeout(() => update({ search: text.trim() }), 350)
    return () => window.clearTimeout(id)
  }, [text, search, update])

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') })
  const courses = useQuery({
    queryKey: ['courses', { search, categoryId, level, price, sort, page }],
    queryFn: () => api.get<PagedResult<CourseCard>>('/courses', { search, categoryId, level, price, sort, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  })

  const filtered = Boolean(search || categoryId || level || price !== 'Any')

  return (
    <>
      <PageHeader title={t.catalog.title} subtitle={t.catalog.subtitle} />

      <div className={s.layout}>
        <aside className={s.filters} aria-label={t.catalog.title}>
          <Input
            icon={<Search aria-hidden />}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.catalog.searchPlaceholder}
            aria-label={t.common.search}
          />

          <fieldset className={s.group}>
            <legend className={s.groupTitle}>{t.home.categories}</legend>
            <button type="button" className={s.option} aria-pressed={!categoryId} onClick={() => update({ categoryId: null })}>
              {t.catalog.allCategories}
            </button>
            {categories.data?.map((c) => (
              <button
                key={c.id}
                type="button"
                className={s.option}
                aria-pressed={categoryId === String(c.id)}
                onClick={() => update({ categoryId: c.id })}
              >
                <TrailDot trail={c.trail} />
                <span className={s.optionLabel}>{c.name}</span>
                <span className={s.optionCount}>{c.courseCount}</span>
              </button>
            ))}
          </fieldset>

          <div className={s.selects}>
            <Select value={level} onChange={(e) => update({ level: e.target.value })} aria-label={t.course.level}>
              <option value="">{t.catalog.anyLevel}</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {t.levels[l]}
                </option>
              ))}
            </Select>
            <Select value={price} onChange={(e) => update({ price: e.target.value })} aria-label={t.catalog.priceLabel}>
              {prices.map((p) => (
                <option key={p} value={p}>
                  {t.catalog.price[p]}
                </option>
              ))}
            </Select>
          </div>

          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {t.catalog.reset}
            </Button>
          )}
        </aside>

        <section className={s.results} aria-busy={courses.isFetching}>
          <div className={s.toolbar}>
            <p className={s.count} aria-live="polite">
              {courses.data ? t.catalog.results(courses.data.totalCount) : ' '}
            </p>
            <Select className={s.sort} value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label={t.catalog.sortLabel}>
              {sorts.map((o) => (
                <option key={o} value={o}>
                  {t.catalog.sort[o]}
                </option>
              ))}
            </Select>
          </div>

          {courses.isPending ? (
            <div className={s.skeletons}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height={300} />
              ))}
            </div>
          ) : courses.isError ? (
            <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
          ) : courses.data.items.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title={t.catalog.emptyTitle}
                text={t.catalog.emptyText}
                action={<Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>{t.catalog.reset}</Button>}
              />
            </Card>
          ) : (
            <>
              <CourseGrid courses={courses.data.items} />
              <Pagination page={courses.data.page} totalPages={courses.data.totalPages} onChange={(p) => update({ page: p })} />
            </>
          )}
        </section>
      </div>
    </>
  )
}
