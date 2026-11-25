import { useState, type FormEvent, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { categories, issueText, promotionSchema, qualificationStates, requirementTypes, statuses, transactionSchema,
  type Promotion, type Requirement, type Transaction } from '../domain/model'
import { moneyInput, parseCents } from '../domain/money'
import { localDate } from '../domain/dates'
import { Modal } from './ui'

const raw = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
const optional = (data: FormData, name: string) => raw(data, name) || undefined
const number = (data: FormData, name: string) => Number(raw(data, name))
const optionalNumber = (data: FormData, name: string) => optional(data, name) === undefined ? undefined : number(data, name)
const cash = (data: FormData, name: string) => parseCents(raw(data, name))
const optionalCash = (data: FormData, name: string) => optional(data, name) === undefined ? undefined : cash(data, name)

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? 'field wide' : 'field'}><span>{label}</span>{children}</label>
}

function CashField({ label, name, value, required = false }: { label: string; name: string; value?: number; required?: boolean }) {
  return <Field label={label}><div className="cash-field"><span aria-hidden="true">$</span>
    <input name={name} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" title="Enter dollars with up to two decimal places"
      maxLength={13} placeholder="0.00" defaultValue={moneyInput(value)} required={required} /></div></Field>
}

function DateField({ label, name, value, required = false }: { label: string; name: string; value?: string; required?: boolean }) {
  return <Field label={label}><input name={name} type="date" min="1900-01-01" max="2199-12-31" defaultValue={value} required={required} /></Field>
}

function CountField({ label, name, value, min = 1, required = false }: { label: string; name: string; value?: number; min?: number; required?: boolean }) {
  return <Field label={label}><input name={name} type="number" min={min} max="36500" step="1" defaultValue={value} required={required} /></Field>
}

type RuleDraft = { id: string; original?: Requirement; type: Requirement['type'] }

function RuleFields({ draft, change, remove }: {
  draft: RuleDraft; change: (value: Requirement['type']) => void; remove: () => void
}) {
  const { id, original, type } = draft
  const same = original?.type === type ? original : undefined
  return <fieldset className="rule-fields">
    <legend>Requirement</legend>
    <div className="form-grid">
      <Field label="Task name" wide><input name={`${id}-title`} required maxLength={120} defaultValue={original?.title} placeholder="e.g. Make two qualifying deposits" /></Field>
      <Field label="Track by"><select value={type} onChange={event => change(event.target.value as Requirement['type'])}>
        {requirementTypes.map(option => <option key={option} value={option}>{option}</option>)}
      </select></Field>
      <DateField label="Requirement deadline" name={`${id}-deadline`} value={original?.deadline} />
      <div className="form-grid wide" key={type}>
        {(type === 'direct deposits' || type === 'minimum balance') &&
          <CashField label="Target amount" name={`${id}-targetCents`} required value={same && 'targetCents' in same ? same.targetCents : undefined} />}
        {(type === 'deposit count' || type === 'debit transactions') && <>
          <CountField label="Required count" name={`${id}-targetCount`} required value={same && 'targetCount' in same ? same.targetCount : undefined} />
          <CashField label="Minimum per transaction" name={`${id}-minimumCents`} value={same && 'minimumCents' in same ? same.minimumCents : undefined} />
        </>}
        {type === 'holding period' && <>
          <CountField label="Days to hold" name={`${id}-targetDays`} required value={same?.type === 'holding period' ? same.targetDays : undefined} />
          <DateField label="Confirmed start date" name={`${id}-startDate`} value={same?.type === 'holding period' ? same.startDate : undefined} />
        </>}
        {type === 'checklist' && <DateField label="Completion date" name={`${id}-completedDate`} value={same?.type === 'checklist' ? same.completedDate : undefined} />}
      </div>
    </div>
    <button className="button ghost remove-rule" type="button" onClick={remove}><Trash2 size={16} /> Remove requirement</button>
  </fieldset>
}

function readRule(data: FormData, { id, type }: RuleDraft): Requirement {
  const common = { id, title: raw(data, `${id}-title`), deadline: optional(data, `${id}-deadline`) }
  switch (type) {
    case 'direct deposits':
    case 'minimum balance':
      return { ...common, type, targetCents: cash(data, `${id}-targetCents`) }
    case 'deposit count':
    case 'debit transactions':
      return { ...common, type, targetCount: number(data, `${id}-targetCount`), minimumCents: optionalCash(data, `${id}-minimumCents`) ?? 0 }
    case 'holding period':
      return { ...common, type, targetDays: number(data, `${id}-targetDays`), startDate: optional(data, `${id}-startDate`) }
    case 'checklist':
      return { ...common, type, completedDate: optional(data, `${id}-completedDate`) }
  }
}

function Footer({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return <div className="dialog-footer">
    <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : label}</button>
  </div>
}

export function PromotionForm({ item, onSave, onClose }: {
  item?: Promotion; onSave: (item: Promotion) => Promise<void>; onClose: () => void
}) {
  const [rules, setRules] = useState<RuleDraft[]>(() => item?.requirements.map(original => ({ id: original.id, original, type: original.type })) ?? [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const selected = promotionSchema.safeParse({
      id: item?.id ?? crypto.randomUUID(), bank: raw(data, 'bank'), accountType: raw(data, 'accountType'),
      bonusCents: cash(data, 'bonusCents'), openedOn: optional(data, 'openedOn'), offerUrl: optional(data, 'offerUrl'),
      promoCode: raw(data, 'promoCode'), terms: raw(data, 'terms'), feeCents: optionalCash(data, 'feeCents') ?? 0,
      feeNotes: raw(data, 'feeNotes'), qualificationDeadline: optional(data, 'qualificationDeadline'),
      qualifiedOn: optional(data, 'qualifiedOn'), payoutMinDays: optionalNumber(data, 'payoutMinDays'),
      payoutMaxDays: optionalNumber(data, 'payoutMaxDays'), closureOn: optional(data, 'closureOn'),
      closureNotes: raw(data, 'closureNotes'), status: raw(data, 'status'), receivedCents: optionalCash(data, 'receivedCents'),
      receivedOn: optional(data, 'receivedOn'), requirements: rules.map(rule => readRule(data, rule)),
    })
    if (!selected.success) {
      setError(issueText(selected.error))
      return
    }
    if ([selected.data.qualifiedOn, selected.data.receivedOn].some(day => day && day > localDate())) {
      setError('Qualification and receipt dates must be today or earlier.')
      return
    }
    setBusy(true)
    setError('')
    try { await onSave(selected.data) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the promotion.') }
    finally { setBusy(false) }
  }

  return <Modal title={item ? 'Edit promotion' : 'New promotion'} onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={submit} autoComplete="off">
      <div className="dialog-content form-sections">
        <section><h3>Promotion details</h3>
          <div className="form-grid">
            <Field label="Bank name"><input name="bank" maxLength={120} required defaultValue={item?.bank} placeholder="e.g. Chase" /></Field>
            <Field label="Account type"><input name="accountType" maxLength={120} required defaultValue={item?.accountType} placeholder="e.g. Checking" /></Field>
            <CashField label="Bonus amount" name="bonusCents" value={item?.bonusCents} required />
            <Field label="Status"><select name="status" defaultValue={item?.status ?? 'considering'}>
              {statuses.map(status => <option key={status}>{status}</option>)}
            </select></Field>
            <DateField label="Opening date" name="openedOn" value={item?.openedOn} />
            <DateField label="Qualification deadline" name="qualificationDeadline" value={item?.qualificationDeadline} />
            <Field label="Offer URL"><input name="offerUrl" type="url" maxLength={2048} defaultValue={item?.offerUrl} placeholder="https://" /></Field>
            <Field label="Promo code"><input name="promoCode" maxLength={120} defaultValue={item?.promoCode} /></Field>
            <Field label="Offer terms" wide><textarea name="terms" maxLength={6000} defaultValue={item?.terms} placeholder="Record offer terms here. Leave out credentials and account numbers." /></Field>
          </div>
        </section>
        <section><h3>Requirements</h3>
          <p className="help">Give each task its own deadline when needed. The promotion’s qualification deadline also applies.</p>
          {rules.map(draft => <RuleFields key={draft.id} draft={draft} change={type =>
            setRules(previous => previous.map(rule => rule.id === draft.id ? { ...rule, type } : rule))
          } remove={() => setRules(previous => previous.filter(rule => rule.id !== draft.id))} />)}
          <button className="button secondary" type="button" disabled={rules.length >= 50}
            onClick={() => setRules(previous => [...previous, { id: crypto.randomUUID(), type: 'direct deposits' }])}>
            <Plus size={17} /> Add requirement</button>
        </section>
        <section><h3>Payout and closure</h3>
          <div className="form-grid">
            <DateField label="Qualified on" name="qualifiedOn" value={item?.qualifiedOn} />
            <CashField label="Account fee" name="feeCents" value={item?.feeCents} />
            <CountField label="Earliest payout (days after qualifying)" name="payoutMinDays" value={item?.payoutMinDays} min={0} />
            <CountField label="Latest payout (days after qualifying)" name="payoutMaxDays" value={item?.payoutMaxDays} min={0} />
            <CashField label="Amount received" name="receivedCents" value={item?.receivedCents} />
            <DateField label="Received on" name="receivedOn" value={item?.receivedOn} />
            <DateField label="Earliest closure date" name="closureOn" value={item?.closureOn} />
            <Field label="Fee notes" wide><textarea name="feeNotes" maxLength={6000} defaultValue={item?.feeNotes} /></Field>
            <Field label="Closure restrictions" wide><textarea name="closureNotes" maxLength={6000} defaultValue={item?.closureNotes} /></Field>
          </div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <Footer onClose={onClose} busy={busy} label="Save promotion" />
    </form>
  </Modal>
}

export function TransactionForm({ item, promotionId, promotions, today, onSave, onClose, onDelete }: {
  item?: Transaction; promotionId?: string; promotions: Promotion[]; today: string;
  onSave: (item: Transaction) => Promise<void>; onClose: () => void; onDelete?: () => void
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const selected = transactionSchema.safeParse({
      id: item?.id ?? crypto.randomUUID(), promotionId: raw(data, 'promotionId'),
      date: raw(data, 'date'), amountCents: cash(data, 'amountCents'), category: raw(data, 'category'),
      qualification: raw(data, 'qualification'), note: raw(data, 'note'),
    })
    if (!selected.success) {
      setError(issueText(selected.error))
      return
    }
    if (selected.data.date > today) {
      setError('Enter a date on or before today.')
      return
    }
    setBusy(true)
    setError('')
    try { await onSave(selected.data) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the ledger entry.') }
    finally { setBusy(false) }
  }

  return <Modal title={item ? 'Edit ledger entry' : 'New ledger entry'} onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={submit} autoComplete="off">
      <div className="dialog-content">
        <div className="form-grid">
          <Field label="Promotion" wide><select name="promotionId" defaultValue={item?.promotionId ?? promotionId ?? ''} required>
            <option value="" disabled>Select a promotion</option>
            {promotions.map(promotion => <option key={promotion.id} value={promotion.id}>{promotion.bank} · {promotion.accountType}</option>)}
          </select></Field>
          <DateField label="Date" name="date" value={item?.date ?? today} required />
          <CashField label="Amount" name="amountCents" value={item?.amountCents} required />
          <Field label="Category"><select name="category" defaultValue={item?.category ?? 'direct deposit'}>
            {categories.map(category => <option key={category}>{category}</option>)}
          </select></Field>
          <Field label="Qualification"><select name="qualification" defaultValue={item?.qualification ?? 'pending'}>
            {qualificationStates.map(status => <option key={status}>{status}</option>)}
          </select></Field>
          <Field label="Note" wide><input name="note" maxLength={240} defaultValue={item?.note} placeholder="e.g. First qualifying deposit" /></Field>
        </div>
        <p className="help">Only entries marked qualifying count toward automatic progress.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      {onDelete && <div className="dialog-content entry-delete"><button className="button ghost" type="button" onClick={onDelete} disabled={busy}><Trash2 size={17} /> Delete entry</button></div>}
      <Footer onClose={onClose} busy={busy} label="Save entry" />
    </form>
  </Modal>
}
