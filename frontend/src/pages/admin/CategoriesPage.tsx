import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { Category, TrailColor } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Field, Input, Textarea } from '@/ui/controls'
import { Card, ErrorState, Loader, PageHeader, TrailDot } from '@/ui/display'
import { Modal, useConfirm, useToast } from '@/ui/overlay'
import a from './Admin.module.css'

const trails: TrailColor[] = ['Blue', 'Red', 'Green', 'Yellow']

const translit: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '',
}

const slugify = (value: string) =>
  [...value.toLowerCase()]
    .map((c) => translit[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(category))
  const [description, setDescription] = useState(category?.description ?? '')
  const [trail, setTrail] = useState<TrailColor>(category?.trail ?? 'Blue')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), slug: slug.trim(), description: description.trim() || null, trail }
      return category ? api.put<Category>(`/admin/categories/${category.id}`, body) : api.post<Category>('/admin/categories', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t.common.saved)
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])))
      else toast.error(e)
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? t.admin.editCategory : t.admin.newCategory}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={save.isPending} disabled={!name.trim() || !slug.trim()} onClick={() => save.mutate()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label={t.admin.categoryName} error={errors.name}>
          {(id, describedBy, invalid) => (
            <Input
              id={id}
              value={name}
              maxLength={80}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
          )}
        </Field>
        <Field label={t.admin.categorySlug} error={errors.slug}>
          {(id, describedBy, invalid) => (
            <Input
              id={id}
              value={slug}
              mono
              maxLength={60}
              aria-describedby={describedBy}
              invalid={invalid}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
          )}
        </Field>
        <Field label={t.admin.categoryDescription} optional={t.common.optional} error={errors.description}>
          {(id) => <Textarea id={id} rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 560, marginBottom: 8 }}>{t.admin.categoryColor}</legend>
          <div className={a.swatches}>
            {trails.map((tr) => (
              <label key={tr} className={a.swatch}>
                <input type="radio" name="trail" checked={trail === tr} onChange={() => setTrail(tr)} />
                <TrailDot trail={tr} />
                {t.admin.colors[tr]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}

export default function CategoriesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const query = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: toast.error,
  })

  return (
    <>
      <PageHeader
        title={t.admin.categories}
        subtitle={t.admin.categoriesSubtitle}
        actions={
          <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
            {t.admin.newCategory}
          </Button>
        }
      />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className={a.categoryGrid}>
          {query.data.map((c) => (
            <Card key={c.id} className={a.category}>
              <span className={a.categoryHead}>
                <TrailDot trail={c.trail} />
                {c.name}
              </span>
              <span className="subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                /{c.slug}
              </span>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {c.description}
              </p>
              <p style={{ fontSize: 'var(--text-xs)' }}>{t.common.courses(c.courseCount)}</p>
              <div className={a.categoryActions}>
                <Button size="sm" variant="ghost" icon={<Pencil aria-hidden />} onClick={() => setEditing(c)}>
                  {t.common.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 aria-hidden />}
                  disabled={c.courseCount > 0}
                  onClick={async () => {
                    if (await confirm({ title: t.admin.deleteCategoryConfirm(c.name), danger: true, confirmLabel: t.common.delete })) remove.mutate(c.id)
                  }}
                >
                  {t.common.delete}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <CategoryModal category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
