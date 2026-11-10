import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { api, ApiError } from '@/api/client'
import type { Category, CourseLevel } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import s from '@/pages/teach/Teach.module.css'
import { Button, Field, Input, Segmented, Select, Textarea } from '@/ui/controls'
import { Markdown } from '@/ui/Markdown'

export interface CourseFormValues {
  title: string
  summary: string
  description: string
  categoryId: number
  level: CourseLevel
  price: number
  outcomes: { value: string }[]
}

export interface CoursePayload {
  title: string
  summary: string
  description: string
  categoryId: number
  level: CourseLevel
  price: number
  outcomes: string[]
}

export const emptyCourse: CourseFormValues = {
  title: '',
  summary: '',
  description: '',
  categoryId: 0,
  level: 'Beginner',
  price: 0,
  outcomes: [{ value: '' }],
}

export function CourseDetailsForm({
  initial,
  submitLabel,
  onSubmit,
  disabled,
}: {
  initial: CourseFormValues
  submitLabel: string
  onSubmit: (payload: CoursePayload) => Promise<unknown>
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') })

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t.validation.required).max(160, t.validation.max(160)),
        summary: z.string().trim().min(1, t.validation.required).max(300, t.validation.max(300)),
        description: z.string().max(20000, t.validation.max(20000)),
        categoryId: z.coerce.number().int().min(1, t.validation.required),
        level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
        price: z.coerce.number().min(0, t.validation.range(0, 100000)).max(100000, t.validation.range(0, 100000)),
        outcomes: z.array(z.object({ value: z.string().max(200, t.validation.max(200)) })),
      }),
    [t],
  )

  const form = useForm<CourseFormValues>({ resolver: zodResolver(schema) as never, defaultValues: initial })
  const outcomes = useFieldArray({ control: form.control, name: 'outcomes' })
  const { errors, isSubmitting, isDirty } = form.formState
  const description = form.watch('description')

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        summary: values.summary.trim(),
        outcomes: values.outcomes.map((o) => o.value.trim()).filter(Boolean),
      })
      form.reset(values)
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          if (field in values) form.setError(field as keyof CourseFormValues, { message: messages[0] })
        }
      }
      throw e
    }
  })

  return (
    <form className={s.formGrid} onSubmit={(e) => void submit(e).catch(() => {})} noValidate>
      <Field label={t.teach.fields.title} error={errors.title?.message}>
        {(id, describedBy, invalid) => <Input id={id} aria-describedby={describedBy} invalid={invalid} {...form.register('title')} />}
      </Field>
      <Field label={t.teach.fields.summary} hint={t.teach.fields.summaryHint} error={errors.summary?.message}>
        {(id, describedBy, invalid) => <Textarea id={id} rows={2} aria-describedby={describedBy} invalid={invalid} {...form.register('summary')} />}
      </Field>

      <div className={s.formRow}>
        <Field label={t.teach.fields.category} error={errors.categoryId?.message}>
          {(id, describedBy, invalid) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} {...form.register('categoryId')}>
              <option value={0} disabled>
                —
              </option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.teach.fields.level}>
          {(id) => (
            <Select id={id} {...form.register('level')}>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((l) => (
                <option key={l} value={l}>
                  {t.levels[l]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.teach.fields.price} hint={t.teach.fields.priceHint} error={errors.price?.message}>
          {(id, describedBy, invalid) => (
            <Input id={id} type="number" min={0} max={100000} step={1} aria-describedby={describedBy} invalid={invalid} {...form.register('price')} />
          )}
        </Field>
      </div>

      <Field label={t.teach.fields.description} hint={t.teach.fields.descriptionHint} error={errors.description?.message}>
        {(id, describedBy, invalid) => (
          <div>
            <div className={s.editorTabs}>
              <Segmented
                label={t.teach.fields.description}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'write', label: t.teach.program.write },
                  { value: 'preview', label: t.teach.program.preview },
                ]}
              />
            </div>
            {mode === 'write' ? (
              <Textarea id={id} rows={10} mono aria-describedby={describedBy} invalid={invalid} {...form.register('description')} />
            ) : (
              <div className={s.preview}>
                <Markdown>{description || '—'}</Markdown>
              </div>
            )}
          </div>
        )}
      </Field>

      <fieldset style={{ margin: 0, padding: 0, border: 0 }} className={s.formGrid}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 560, marginBottom: 6 }}>{t.teach.fields.outcomes}</legend>
        {outcomes.fields.map((field, i) => (
          <div key={field.id} className={s.outcomeRow}>
            <Input
              placeholder={t.teach.fields.outcomePlaceholder}
              aria-label={`${t.teach.fields.outcomes} ${i + 1}`}
              invalid={Boolean(errors.outcomes?.[i]?.value)}
              {...form.register(`outcomes.${i}.value`)}
            />
            <Button variant="ghost" iconOnly aria-label={t.common.delete} icon={<X />} onClick={() => outcomes.remove(i)} />
          </div>
        ))}
        <div>
          <Button size="sm" variant="soft" icon={<Plus aria-hidden />} onClick={() => outcomes.append({ value: '' })} disabled={outcomes.fields.length >= 10}>
            {t.teach.fields.addOutcome}
          </Button>
        </div>
      </fieldset>

      <div className={s.formActions}>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={disabled || (!isDirty && initial !== emptyCourse)}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
