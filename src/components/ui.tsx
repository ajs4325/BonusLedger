import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDownToLine, CalendarDays, CircleCheck, Landmark, X } from 'lucide-react'
import { formatDate, daysBetween } from '../domain/dates'
import type { Deadline } from '../domain/dashboard'
import type { Promotion } from '../domain/model'
import { createIcs } from '../domain/ics'
import { downloadFile } from '../download'

export function BankMark({ bank }: { bank: string }) {
  const name = bank.toLowerCase()
  const color = name.includes('chase') ? 'blue' : name.includes('capital') ? 'rose'
    : name.includes('wells') ? 'amber' : name.includes('discover') ? 'green' : 'violet'
  return <span className={`bank-mark ${color}`} aria-hidden="true"><Landmark size={19} strokeWidth={1.85} /></span>
}

export function Status({ status }: { status: Promotion['status'] }) {
  return <span className={`status status-${status.replaceAll(' ', '-')}`}>{status}</span>
}

export function Meter({ ratio, label }: { ratio: number; label: string }) {
  return <progress className="meter" max={1} value={ratio} aria-label={label} />
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty">
    <span className="empty-icon"><Landmark size={22} /></span>
    <strong>{title}</strong>
    <p>{children}</p>
    {action}
  </div>
}

export function Modal({ title, children, onClose, compact = false }: {
  title: string; children: ReactNode; onClose: () => void; compact?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={compact ? 'dialog compact' : 'dialog'} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
    </div>
    {children}
  </dialog>
}

export function Confirm({ title, children, confirmLabel, onClose, onConfirm }: {
  title: string; children: ReactNode; confirmLabel: string; onClose: () => void; onConfirm: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setPending(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The operation could not be completed.')
    } finally {
      setPending(false)
    }
  }
  return <Modal title={title} onClose={() => { if (!pending) onClose() }} compact>
    <div className="dialog-content">{children}{error && <p className="form-error" role="alert">{error}</p>}</div>
    <div className="dialog-footer">
      <button className="button secondary" type="button" onClick={onClose} disabled={pending}>Cancel</button>
      <button className="button danger" type="button" onClick={confirm} disabled={pending}>{confirmLabel}</button>
    </div>
  </Modal>
}

export function DeadlineRow({ item, today, open, download = false }: {
  item: Deadline; today: string; open: (id: string) => void; download?: boolean
}) {
  const late = item.date < today && ['requirement', 'qualification'].includes(item.kind)
  return <div className="deadline-row">
    <button className="row-button" type="button" onClick={() => open(item.promotionId)}>
      <span className={`date-tile ${item.kind === 'payout' ? 'payout-tile' : ''}`}>
        <span>{formatDate(item.date).split(' ')[0]}</span><strong>{Number(item.date.slice(-2))}</strong>
      </span>
      <span className="row-text"><strong>{item.title}</strong><small>{item.bank} <span aria-hidden="true">·</span> {formatDate(item.date, item.date.slice(0, 4) !== today.slice(0, 4))}</small></span>
      {late && <span className="late">Overdue</span>}
    </button>
    {download && <button className="icon-button" aria-label={`Download reminder for ${item.title}`}
      type="button" onClick={() => downloadFile('bonusledger-reminder.ics', createIcs([item]), 'text/calendar;charset=utf-8')}>
      <ArrowDownToLine size={17} /></button>}
  </div>
}

export function DueLabel({ date, today }: { date?: string; today: string }) {
  if (!date) return null
  const diff = daysBetween(today, date)
  return <span className={`due-label ${diff < 0 ? 'late' : ''}`}><CalendarDays size={14} aria-hidden="true" />
    {diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : formatDate(date)}
  </span>
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="toast" role="status"><CircleCheck size={18} />{children}</div>
}
