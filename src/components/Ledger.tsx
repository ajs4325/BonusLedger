import { useState } from 'react'
import { ArrowDownLeft, ChevronRight, Plus, Receipt, Wallet } from 'lucide-react'
import { formatDate } from '../domain/dates'
import { money } from '../domain/money'
import { qualificationStates, type Promotion, type Transaction } from '../domain/model'
import { Empty } from './ui'

export function Ledger({ promotions, transactions, add, edit, addPromotion }: {
  promotions: Promotion[]; transactions: Transaction[]; add: () => void;
  edit: (entry: Transaction) => void; addPromotion: () => void
}) {
  const [promotion, setPromotion] = useState('all')
  const [qualification, setQualification] = useState('all')
  const promotionMap = new Map(promotions.map(item => [item.id, item]))
  const matches = transactions.filter(item => (promotion === 'all' || item.promotionId === promotion) &&
    (qualification === 'all' || item.qualification === qualification)).sort((a, b) => b.date.localeCompare(a.date))

  return <>
    <section className="page-heading"><div><h1>Ledger</h1><p>Record the activity that counts toward your bonuses.</p></div>
      <button type="button" className="button primary" onClick={add} disabled={!promotions.length}><Plus size={19} /> New entry</button></section>
    <section className="panel">
      <div className="filters">
        <select aria-label="Filter by promotion" value={promotion} onChange={event => setPromotion(event.target.value)}>
          <option value="all">All promotions</option>{promotions.map(item => <option key={item.id} value={item.id}>{item.bank} · {item.accountType}</option>)}
        </select>
        <select aria-label="Filter by qualification" value={qualification} onChange={event => setQualification(event.target.value)}>
          <option value="all">All qualification statuses</option>{qualificationStates.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      {matches.length ? matches.map(entry => {
        const Icon = entry.category === 'direct deposit' || entry.category === 'deposit' ? ArrowDownLeft : entry.category === 'balance snapshot' ? Wallet : Receipt
        const bank = promotionMap.get(entry.promotionId)
        return <button type="button" className="ledger-row" onClick={() => edit(entry)} key={entry.id}>
          <span className="metric-icon violet"><Icon size={19} /></span>
          <span className="row-text capitalize"><strong>{entry.category}</strong><small>{bank?.bank} · {formatDate(entry.date, true)}</small>{entry.note && <small>{entry.note}</small>}</span>
          <span className={`status qualification-${entry.qualification}`}>{entry.qualification}</span>
          <strong className="row-amount">{money(entry.amountCents)}</strong><ChevronRight size={17} className="row-chevron" />
        </button>
      }) : <Empty title={transactions.length ? 'No matching ledger entries' : 'No ledger entries yet'}
        action={!transactions.length && <button type="button" className="button secondary" onClick={promotions.length ? add : addPromotion}>
          <Plus size={17} /> {promotions.length ? 'Add ledger entry' : 'Add promotion'}</button>}>
        {transactions.length ? 'Change your filters to see more activity.' : promotions.length
          ? 'Add a qualifying direct deposit, debit purchase, or balance snapshot.'
          : 'Create a promotion first so you can link your entries to it.'}
      </Empty>}
    </section>
  </>
}
