import { ArrowDownLeft, ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, ListTodo, Plus, Wallet } from 'lucide-react'
import { activeStatuses, financialTotals, tasks, type Deadline } from '../domain/dashboard'
import { formatDate } from '../domain/dates'
import { money } from '../domain/money'
import type { Promotion, Transaction } from '../domain/model'
import { promotionProgress } from '../domain/progress'
import { BankMark, DeadlineRow, DueLabel, Empty, Meter, Status } from './ui'

export function Dashboard({ promotions, transactions, deadlines, today, open, add, showPromotions, showCalendar, isDemo, tryDemo }: {
  promotions: Promotion[]; transactions: Transaction[]; deadlines: Deadline[]; today: string;
  open: (id: string) => void; add: () => void; showPromotions: () => void; showCalendar: () => void;
  isDemo: boolean; tryDemo: () => void
}) {
  const totals = financialTotals(promotions, today)
  const active = promotions.filter(item => activeStatuses.includes(item.status))
    .sort((a, b) => (a.qualificationDeadline ?? '9999').localeCompare(b.qualificationDeadline ?? '9999'))
  const next = deadlines.filter(item => item.date >= today || ['requirement', 'qualification'].includes(item.kind)).slice(0, 4)
  const actionable = tasks(promotions, transactions, today)
  return <>
    <section className="page-heading">
      <div><h1>Dashboard</h1><p>Track your bank bonuses and what’s due next.</p></div>
      <button className="button primary" type="button" onClick={add}><Plus size={19} /> New promotion</button>
    </section>
    <section className="summary-grid" aria-label="Bonus summary">
      <article className="hero">
        <div className="hero-pattern" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span className="hero-shine" /></div>
        <span className="hero-label"><CircleDollarSign size={20} /> Potential bonuses</span>
        <strong>{money(totals.potential)}</strong>
        <p>Offers you’re considering or working toward</p>
      </article>
      <div className="summary-side">
        <article className="metric">
          <span className="metric-icon green"><ArrowDownLeft size={21} /></span>
          <div><h2>Bonuses received</h2><strong>{money(totals.received)}</strong></div>
        </article>
        <article className="metric">
          <span className="metric-icon violet"><Wallet size={20} /></span>
          <div><h2>Active promotions</h2><strong>{totals.active.toLocaleString('en-US')}</strong></div>
        </article>
      </div>
    </section>
    <div className="dashboard-grid">
      <section className="panel dashboard-promotions">
        <div className="panel-heading"><h2>Active promotions</h2><button type="button" className="text-button" onClick={showPromotions}>View all <ArrowRight size={16} /></button></div>
        {active.length ? <div className="active-list">{active.slice(0, 5).map(promotion => {
          const progress = promotionProgress(promotion, transactions, today)
          return <button key={promotion.id} type="button" className="active-row" onClick={() => open(promotion.id)}>
            <BankMark bank={promotion.bank} />
            <span className="row-text"><strong>{promotion.bank}</strong><small>{promotion.accountType}</small></span>
            <span className="row-progress">
              {promotion.status === 'active' && progress.rules.length ? <>
                <span><span>Progress</span><strong>{Math.round(progress.ratio * 100)}%</strong></span>
                <Meter ratio={progress.ratio} label={`${promotion.bank} requirement progress`} />
              </> : <Status status={promotion.status} />}
            </span>
            <strong className="row-amount">{money(promotion.bonusCents, true)}</strong>
            <ChevronRight className="row-chevron" size={17} />
          </button>
        })}</div> : <Empty title="No active promotions" action={!isDemo && !promotions.length
          ? <button type="button" className="button secondary" onClick={tryDemo}>Try demo workspace</button>
          : <button type="button" className="button secondary" onClick={showPromotions}>Browse promotions</button>}>
          {promotions.length ? 'Active, qualified, and awaiting payout offers appear here.' : 'Add an offer to start tracking your progress.'}
        </Empty>}
      </section>
      <section className="panel dashboard-deadlines">
        <div className="panel-heading"><h2>Upcoming deadlines</h2><button type="button" className="icon-button purple" onClick={showCalendar} aria-label="Open calendar"><CalendarDays size={19} /></button></div>
        {next.length ? <div className="deadline-list">{next.map(item =>
          <DeadlineRow key={item.id} item={item} today={today} open={open} />,
        )}</div> : <Empty title="You’re all caught up">Qualification, payout, and closure dates will appear here.</Empty>}
      </section>
      <section className="panel dashboard-tasks">
        <div className="panel-heading"><h2><ListTodo size={20} /> Action items</h2>
          <span className="count-badge">{actionable.length} open</span></div>
        {actionable.length ? actionable.slice(0, 5).map(task =>
          <button key={`${task.promotionId}-${task.id}`} className="task-row" type="button" onClick={() => open(task.promotionId)}>
            <span className="task-circle" aria-hidden="true" />
            <span className="row-text"><strong>{task.title}</strong><small>{task.bank}{task.date && ` · Due ${formatDate(task.date)}`}</small></span>
            <DueLabel date={task.date} today={today} />
            <ChevronRight size={17} className="row-chevron" />
          </button>,
        ) : <Empty title="No open tasks">Add requirements to an active promotion to see next steps here.</Empty>}
      </section>
    </div>
  </>
}
