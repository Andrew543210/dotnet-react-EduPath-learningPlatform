import clsx from 'clsx'
import type { RouteStop } from '@/api/types'
import s from './RouteTrack.module.css'

export function RouteTrack({ stops, currentId, label }: { stops: RouteStop[]; currentId?: number | null; label?: string }) {
  return (
    <ol className={s.track} aria-label={label}>
      {stops.map((stop, i) => (
        <li
          key={stop.id}
          className={clsx(s.stop, stop.isCompleted && s.done, stop.id === currentId && s.current, stop.hasTest && s.test)}
          title={`${i + 1}. ${stop.title}`}
        >
          <span className="visually-hidden">
            {i + 1}. {stop.title}
            {stop.isCompleted ? ' ✓' : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}
