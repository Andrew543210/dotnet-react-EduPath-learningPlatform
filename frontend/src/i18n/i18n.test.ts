import { en } from './en'
import { pluralEn, pluralUk } from './plural'
import { uk } from './uk'

function shape(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [`${prefix}:fn`]
  if (Array.isArray(value)) return [`${prefix}:array${value.length}`, ...value.flatMap((v, i) => shape(v, `${prefix}[${i}]`))]
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k))
  return [`${prefix}:${typeof value}`]
}

describe('dictionaries', () => {
  it('have identical keys in Ukrainian and English', () => {
    expect(shape(en).sort()).toEqual(shape(uk).sort())
  })

  it('contain no empty strings', () => {
    expect(JSON.stringify(uk)).not.toContain('""')
    expect(JSON.stringify(en)).not.toContain('""')
  })
})

describe('plural rules', () => {
  it('picks Ukrainian forms', () => {
    const lessons = (n: number) => pluralUk(n, 'урок', 'уроки', 'уроків')
    expect([1, 2, 5, 11, 21, 22, 25, 111].map(lessons)).toEqual([
      '1 урок', '2 уроки', '5 уроків', '11 уроків', '21 урок', '22 уроки', '25 уроків', '111 уроків',
    ])
  })

  it('picks English forms', () => {
    expect(pluralEn(1, 'lesson', 'lessons')).toBe('1 lesson')
    expect(pluralEn(0, 'lesson', 'lessons')).toBe('0 lessons')
    expect(pluralEn(7, 'lesson', 'lessons')).toBe('7 lessons')
  })

  it('uses plurals inside messages', () => {
    expect(uk.common.courses(3)).toContain('3')
    expect(en.common.courses(1)).toMatch(/1 course\b/)
  })
})
