import { useEffect, useId, useRef, useState } from 'react'
import type { WeeklyPoint } from '@/api/types'
import { useI18n } from '@/i18n/I18nProvider'
import s from './Charts.module.css'

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

function compact(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n)
}

function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export function WeeklyChart({ points, format, label }: { points: WeeklyPoint[]; format: (v: number) => string; label: string }) {
  const { t, f, language } = useI18n()
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()
  const locale = language === 'uk' ? 'uk-UA' : 'en-GB'

  const plotRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = plotRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const height = 220
  const pad = { top: 12, right: 8, bottom: 28, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(0, ...points.map((p) => p.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const band = innerW / Math.max(1, points.length)
  const barW = Math.min(24, band * 0.6)
  const y = (v: number) => pad.top + innerH - (v / top) * innerH
  const total = points.reduce((sum, p) => sum + p.value, 0)

  if (points.length === 0 || max === 0) return <p className={s.noData}>{t.charts.noData}</p>

  const activePoint = active !== null ? points[active] : null

  return (
    <figure className={s.figure}>
      <div className={s.plot} ref={plotRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className={s.svg} role="img" aria-label={label} aria-describedby={tableId}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={s.grid} />
              <text x={pad.left - 8} y={y(tick)} className={s.tick} textAnchor="end" dominantBaseline="middle">
                {compact(tick, locale)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = pad.left + band * i + (band - barW) / 2
            const h = (p.value / top) * innerH
            const every = band < 34 ? 3 : band < 56 ? 2 : 1
            const showLabel = (points.length - 1 - i) % every === 0
            return (
              <g key={p.weekStart}>
                <path d={columnPath(x, y(p.value), barW, h)} className={active === i ? s.barActive : s.bar} />
                {showLabel && (
                  <text x={x + barW / 2} y={height - 8} className={s.tick} textAnchor="middle">
                    {f.shortDate(p.weekStart)}
                  </text>
                )}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={innerH}
                  className={s.hit}
                  tabIndex={0}
                  aria-label={`${t.charts.week(f.shortDate(p.weekStart))}: ${format(p.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            )
          })}
          {points.length > 0 && (
            <text
              x={pad.left + band * (points.length - 1) + band / 2}
              y={y(points[points.length - 1].value) - 6}
              className={s.valueLabel}
              textAnchor="middle"
            >
              {format(points[points.length - 1].value)}
            </text>
          )}
        </svg>
        {activePoint && active !== null && (
          <div
            className={s.tooltip}
            style={{
              left: `${((pad.left + band * active + band / 2) / width) * 100}%`,
              top: `${(y(activePoint.value) / height) * 100}%`,
            }}
            role="presentation"
          >
            <strong>{format(activePoint.value)}</strong>
            <span>{t.charts.week(f.shortDate(activePoint.weekStart))}</span>
          </div>
        )}
      </div>
      <figcaption className={s.caption}>
        {t.charts.total}: <strong>{format(total)}</strong>
      </figcaption>
      <details className={s.tableToggle}>
        <summary>{t.charts.showTable}</summary>
        <table id={tableId} className={s.table}>
          <thead>
            <tr>
              <th scope="col">{t.charts.weekColumn}</th>
              <th scope="col" className={s.num}>
                {label}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.weekStart}>
                <td>{f.date(p.weekStart)}</td>
                <td className={s.num}>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export function FunnelBars({ rows, total }: { rows: { key: number; label: string; value: number }[]; total: number }) {
  const { f } = useI18n()
  const max = Math.max(1, total, ...rows.map((r) => r.value))
  return (
    <ol className={s.funnel}>
      {rows.map((r, i) => (
        <li key={r.key} className={s.funnelRow} title={`${r.label}: ${r.value}`}>
          <span className={s.funnelIndex}>{i + 1}</span>
          <span className={s.funnelLabel}>{r.label}</span>
          <span className={s.funnelTrack}>
            <span className={s.funnelBar} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className={s.funnelValue}>
            {f.number(r.value)}
            {total > 0 && <span className={s.funnelShare}> ({Math.round((r.value / total) * 100)}%)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
