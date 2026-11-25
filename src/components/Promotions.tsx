import { useState } from 'react'
import { ArrowLeft, Check, ChevronRight, ExternalLink, ListChecks, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { formatDate, addDays } from '../domain/dates'
import { money } from '../domain/money'
import { statuses, type Promotion, type Transaction } from '../domain/model'
import { effectiveDeadline, promotionProgress } from '../domain/progress'
import { BankMark, Empty, Meter, Status } from './ui'

export function Promotions({ promotions, transactions, today, open, add }: {
  promotions: Promotion[]; transactions: Transaction[]; today: string; open: (id: string) => void; add: () => void
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const matches = promotions.filter(item => (filter === 'all' || item.status === filter) &&
    `${item.bank} ${item.accountType}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.bank.localeCompare(b.bank) || a.accountType.localeCompare(b.accountType))

  return <>
    <section className="page-heading"><div><h1>Promotions</h1><p>Manage your offers, requirements, and payouts.</p></div>
      <button type="button" className="button primary" onClick={add}><Plus size={19} /> New promotion</button></section>
    <section className="panel">
      <div className="filters">
        <label className="search"><Search size={18} /><input type="search" placeholder="Search promotions" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search promotions" /></label>
        <select aria-label="Filter by status" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}
        </select>
      </div>
      {matches.length ? matches.map(item => {
        const progress = promotionProgress(item, transactions, today)
        return <button type="button" className="promotion-row" onClick={() => open(item.id)} key={item.id}>
          <BankMark bank={item.bank} /><span className="row-text"><strong>{item.bank}</strong><small>{item.accountType}</small></span>
          <Status status={item.status} />
          <span className="list-meter">{progress.rules.length > 0 && <>
            <small>{progress.complete}/{progress.rules.length} met</small>
            <Meter ratio={progress.ratio} label={`${item.bank} progress`} />
          </>}</span>
          <strong className="row-amount">{money(item.bonusCents, true)}</strong>
          <ChevronRight size={18} className="row-chevron" />
        </button>
      }) : <Empty title={promotions.length ? 'No matching promotions' : 'Add your first promotion'}
        action={!promotions.length && <button type="button" className="button secondary" onClick={add}><Plus size={17} /> New promotion</button>}>
        {promotions.length ? 'Change the filters to see more offers.' : 'Save the terms and start tracking your requirements.'}
      </Empty>}
    </section>
  </>
}

export function PromotionDetail({ item, transactions, today, back, edit, remove, addEntry, editEntry, completeChecklist }: {
  item: Promotion; transactions: Transaction[]; today: string; back: () => void; edit: () => void;
  remove: () => void; addEntry: () => void; editEntry: (item: Transaction) => void;
  completeChecklist: (ruleId: string) => void
}) {
  const progress = promotionProgress(item, transactions, today)
  const entries = transactions.filter(entry => entry.promotionId === item.id).sort((a, b) => b.date.localeCompare(a.date))
  const dateText = (date?: string) => date ? formatDate(date, true) : '—'
  const payoutText = [item.payoutMinDays, item.payoutMaxDays].map(days => days === undefined ? undefined
    : item.qualifiedOn ? formatDate(addDays(item.qualifiedOn, days), true) : `${days} days after qualification`)
  return <>
    <button type="button" className="text-button back-link" onClick={back}><ArrowLeft size={17} /> Promotions</button>
    <section className="page-heading detail-heading">
      <div className="detail-title"><BankMark bank={item.bank} /><div><h1>{item.bank}</h1><p>{item.accountType}</p></div></div>
      <button type="button" className="button secondary" onClick={edit}><Pencil size={16} /> Edit promotion</button>
    </section>
    <div className="detail-grid">
      <section className="panel detail-meta">
        <div className="panel-heading"><h2>Offer details</h2><Status status={item.status} /></div>
        <div className="panel-body">
          <div className="detail-bonus"><span>Offered bonus</span><strong>{money(item.bonusCents)}</strong></div>
          <dl className="data-list">
            <div><dt>Opened</dt><dd>{dateText(item.openedOn)}</dd></div>
            <div><dt>Qualification deadline</dt><dd>{dateText(item.qualificationDeadline)}</dd></div>
            <div><dt>Qualified</dt><dd>{dateText(item.qualifiedOn)}</dd></div>
            <div><dt>Payout window</dt><dd>{payoutText[0] && payoutText[1] && payoutText[0] !== payoutText[1]
              ? `${payoutText[0]} – ${payoutText[1]}` : payoutText[1] ? `By ${payoutText[1]}` : payoutText[0] ? `From ${payoutText[0]}` : '—'}</dd></div>
            <div><dt>Received</dt><dd>{item.receivedCents === undefined ? '—' : `${money(item.receivedCents)} · ${dateText(item.receivedOn)}`}</dd></div>
            <div><dt>Account fee</dt><dd>{money(item.feeCents)}</dd></div>
            <div><dt>Earliest closure</dt><dd>{dateText(item.closureOn)}</dd></div>
            {item.promoCode && <div><dt>Promo code</dt><dd>{item.promoCode}</dd></div>}
          </dl>
          {item.terms && <div className="note"><h3>Offer terms</h3><p>{item.terms}</p></div>}
          {item.feeNotes && <div className="note"><h3>Fee notes</h3><p>{item.feeNotes}</p></div>}
          {item.closureNotes && <div className="note"><h3>Closure restrictions</h3><p>{item.closureNotes}</p></div>}
          {item.offerUrl && <a href={item.offerUrl} className="text-button offer-link" target="_blank" rel="noreferrer noopener">Open offer URL <ExternalLink size={16} /></a>}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2><ListChecks size={20} /> Requirements</h2><span className="count-badge">{progress.complete}/{progress.rules.length} met</span></div>
        {progress.rules.length ? progress.rules.map(result => {
          const { rule } = result
          const due = effectiveDeadline(rule, item)
          const progressLabel = result.unit === 'cents' ? `${money(result.current)} of ${money(result.target)}`
            : result.unit === 'check' ? result.complete ? 'Complete' : 'Incomplete'
              : `${result.current} of ${result.target}${result.unit === 'days' ? ' days' : ''}`
          const canCheck = rule.type === 'checklist' && !rule.completedDate && (!item.openedOn || item.openedOn <= today)
          return <article className="requirement-row" key={rule.id}>
            <div className="requirement-title">
              <span className={result.complete ? 'task-circle checked' : 'task-circle'}>{result.complete && <Check size={13} />}</span>
              <div className="row-text"><strong>{rule.title}</strong><small>{rule.type}{due ? ` · Due ${formatDate(due, true)}` : ''}</small></div>
            </div>
            <div className="rule-progress">
              <small>{progressLabel}</small><Meter ratio={result.ratio} label={rule.title} />
            </div>
            {rule.type === 'minimum balance' && <p className="help">Uses the latest qualifying balance snapshot within the allowed dates.</p>}
            {rule.type === 'holding period' && <p className="help">{rule.startDate
              ? `Confirmed start ${dateText(rule.startDate)} · Ends ${dateText(addDays(rule.startDate, rule.targetDays))}`
              : 'Set the confirmed start date in the promotion editor.'}</p>}
            {canCheck && <button type="button" className="button secondary" onClick={() => completeChecklist(rule.id)}>Record completion today</button>}
            {rule.type === 'checklist' && rule.completedDate && <p className="help">Recorded {dateText(rule.completedDate)}.</p>}
          </article>
        }) : <Empty title="No requirements added" action={<button type="button" className="button secondary" onClick={edit}>Edit promotion</button>}>
          Add the tasks specified in this offer’s terms.
        </Empty>}
      </section>
      <section className="panel detail-ledger">
        <div className="panel-heading"><h2>Linked ledger entries</h2><button type="button" className="text-button" onClick={addEntry}><Plus size={17} /> Add entry</button></div>
        {entries.length ? entries.map(entry => <button type="button" className="task-row" key={entry.id} onClick={() => editEntry(entry)}>
          <span className="row-text capitalize"><strong>{entry.category}</strong><small>{formatDate(entry.date, true)} · {entry.qualification}</small></span>
          <strong>{money(entry.amountCents)}</strong><ChevronRight size={16} className="row-chevron" />
        </button>) : <Empty title="No linked entries">Record deposits, purchases, or balance snapshots for this promotion.</Empty>}
      </section>
    </div>
    <button type="button" className="button ghost delete-promotion" onClick={remove}><Trash2 size={17} /> Delete promotion</button>
  </>
}
