import { useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Deadline } from '../domain/dashboard'
import { calendarDays, formatDate, monthLabel, shiftMonth } from '../domain/dates'
import { createIcs } from '../domain/ics'
import { downloadFile } from '../download'
import { DeadlineRow, Empty } from './ui'

export function Calendar({ items, today, open }: { items: Deadline[]; today: string; open: (id: string) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string>()
  const [view, setView] = useState<'calendar' | 'agenda'>('calendar')
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const visible = view === 'agenda' ? items : items.filter(item => selected ? item.date === selected : item.date.startsWith(month))
  const exportable = items.filter(item => item.date >= today)
  function changeMonth(value: string) {
    setMonth(value)
    setSelected(undefined)
  }
  return <>
    <section className="page-heading"><div><h1>Calendar</h1><p>Stay on top of qualification, payout, and closure dates.</p></div>
      <button type="button" className="button primary" disabled={!exportable.length}
        onClick={() => downloadFile('bonusledger-upcoming.ics', createIcs(exportable), 'text/calendar;charset=utf-8')}>
        <ArrowDownToLine size={18} /> Export upcoming</button></section>
    <div className="calendar-controls">
      <div className="segmented" role="group" aria-label="Calendar display">
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
        <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Agenda</button>
      </div>
      {view === 'calendar' && <button type="button" className="button secondary" onClick={() => changeMonth(today.slice(0, 7))}>Today</button>}
    </div>
    <div className={view === 'calendar' ? 'detail-grid calendar-grid' : ''}>
      {view === 'calendar' && <section className="panel calendar-panel" aria-label="Month view">
        <div className="panel-heading"><h2>{monthLabel(month)}</h2><div className="month-buttons">
          <button type="button" className="icon-button" aria-label="Previous month" disabled={month <= '1900-01'}
            onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></button>
          <button type="button" className="icon-button" aria-label="Next month" disabled={month >= '2299-12'}
            onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></button>
        </div></div>
        <div className="month-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span className="weekday" key={day}>{day}</span>)}
          {calendarDays(month).map(day => {
            const count = counts.get(day) ?? 0
            return <button type="button" key={day}
              className={`calendar-day ${day.startsWith(month) ? '' : 'outside'}`}
              aria-label={`${formatDate(day, true)}${count ? `, ${count} ${count === 1 ? 'event' : 'events'}` : ''}`}
              aria-current={day === today ? 'date' : undefined} aria-pressed={day === selected}
              onClick={() => {
                setMonth(day.slice(0, 7))
                setSelected(day === selected ? undefined : day)
              }}><span>{Number(day.slice(-2))}</span>{count > 0 && <span className="event-dot" aria-hidden="true" />}</button>
          })}
        </div>
      </section>}
      <section className="panel">
        <div className="panel-heading"><h2>{view === 'agenda' ? 'All scheduled dates'
          : selected ? formatDate(selected, true) : 'This month'}</h2>
          {selected && view === 'calendar' && <button type="button" className="text-button" onClick={() => setSelected(undefined)}>Show month</button>}</div>
        {visible.length ? <div className="deadline-list">{visible.map(item => <DeadlineRow key={item.id} item={item} today={today} open={open} download />)}</div>
          : <Empty title="No scheduled events">Add dates to a promotion to see them here.</Empty>}
      </section>
    </div>
  </>
}
