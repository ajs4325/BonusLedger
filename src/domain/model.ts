import { z } from 'zod'

export const statuses = ['considering', 'active', 'qualified', 'awaiting payout', 'paid', 'closed', 'expired', 'abandoned'] as const
export const categories = ['direct deposit', 'deposit', 'debit purchase', 'balance snapshot', 'other'] as const
export const qualificationStates = ['qualifying', 'pending', 'excluded'] as const
export const requirementTypes = ['direct deposits', 'deposit count', 'debit transactions', 'minimum balance', 'holding period', 'checklist'] as const
export const themes = ['system', 'light', 'dark'] as const

const id = z.string().uuid()
const label = z.string().trim().min(1).max(120)
const notes = z.string().max(6000)
const count = z.number().int().min(1).max(36500)
const days = z.number().int().min(0).max(36500)
export const cents = z.number().int().min(0).max(99_999_999_999)
export const date = z.iso.date().refine(value => value >= '1900-01-01' && value <= '2199-12-31', 'Date must be between 1900 and 2199.')
const optionalDate = date.optional()
const offerUrl = z.url({ protocol: /^https?$/ }).max(2048).refine(value => {
  try {
    const url = new URL(value)
    return !url.username && !url.password
  } catch {
    return false
  }
}, 'Enter a web link without embedded credentials.')

export const requirementSchema = z.discriminatedUnion('type', [
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('direct deposits'), targetCents: cents.min(1) }),
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('deposit count'), targetCount: count, minimumCents: cents }),
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('debit transactions'), targetCount: count, minimumCents: cents }),
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('minimum balance'), targetCents: cents.min(1) }),
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('holding period'), targetDays: count, startDate: optionalDate }),
  z.strictObject({ id, title: label, deadline: optionalDate, type: z.literal('checklist'), completedDate: optionalDate }),
])

export const promotionSchema = z.strictObject({
  id,
  bank: label,
  accountType: label,
  bonusCents: cents,
  openedOn: optionalDate,
  offerUrl: offerUrl.optional(),
  promoCode: z.string().max(120),
  terms: notes,
  feeCents: cents,
  feeNotes: notes,
  qualificationDeadline: optionalDate,
  qualifiedOn: optionalDate,
  payoutMinDays: days.optional(),
  payoutMaxDays: days.optional(),
  closureOn: optionalDate,
  closureNotes: notes,
  status: z.enum(statuses),
  receivedCents: cents.optional(),
  receivedOn: optionalDate,
  requirements: z.array(requirementSchema).max(50),
}).superRefine((value, ctx) => {
  const issue = (field: string, message: string) => ctx.addIssue({ code: 'custom', path: [field], message })
  if (value.openedOn) {
    for (const [field, fieldValue] of [
      ['qualificationDeadline', value.qualificationDeadline],
      ['qualifiedOn', value.qualifiedOn],
      ['closureOn', value.closureOn],
      ['receivedOn', value.receivedOn],
    ] as const) {
      if (fieldValue && fieldValue < value.openedOn) issue(field, 'This date must be on or after opening.')
    }
    if (value.requirements.some(rule => rule.deadline && rule.deadline < value.openedOn!)) {
      issue('requirements', 'Requirement deadlines must be on or after opening.')
    }
  }
  if (value.receivedOn && value.qualifiedOn && value.receivedOn < value.qualifiedOn) {
    issue('receivedOn', 'Receipt date must be on or after qualification.')
  }
  if ((value.payoutMinDays ?? 0) > (value.payoutMaxDays ?? Infinity)) {
    issue('payoutMaxDays', 'Latest payout must be at or after earliest payout.')
  }
  if ((value.receivedCents === undefined) !== (value.receivedOn === undefined) ||
      (value.status === 'paid' && value.receivedOn === undefined)) {
    issue('receivedOn', 'Enter both the received amount and receipt date to record a payout.')
  }
  if (new Set(value.requirements.map(rule => rule.id)).size !== value.requirements.length) {
    issue('requirements', 'Requirement IDs must be unique within a promotion.')
  }
})

export const transactionSchema = z.strictObject({
  id,
  promotionId: id,
  date,
  amountCents: cents,
  category: z.enum(categories),
  qualification: z.enum(qualificationStates),
  note: z.string().max(240),
}).refine(value => value.amountCents > 0 || value.category === 'balance snapshot', {
  path: ['amountCents'],
  message: 'Enter a positive amount. Zero is allowed for balance snapshots.',
})

export const backupSchema = z.strictObject({
  format: z.literal('BonusLedger'),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  promotions: z.array(promotionSchema).max(10000),
  transactions: z.array(transactionSchema).max(100000),
  theme: z.enum(themes),
}).superRefine((value, ctx) => {
  const promotions = new Set(value.promotions.map(item => item.id))
  const transactions = new Set(value.transactions.map(item => item.id))
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
  if (promotions.size !== value.promotions.length) issue('promotions', 'Duplicate promotion IDs.')
  if (transactions.size !== value.transactions.length) issue('transactions', 'Duplicate transaction IDs.')
  if (value.transactions.some(item => !promotions.has(item.promotionId))) {
    issue('transactions', 'Each ledger entry must reference a promotion in this backup.')
  }
})

export type Promotion = z.infer<typeof promotionSchema>
export type Requirement = z.infer<typeof requirementSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type Theme = (typeof themes)[number]
export type Backup = z.infer<typeof backupSchema>

export function issueText(error: z.ZodError) {
  return error.issues.slice(0, 5).map(issue =>
    `${issue.path.length ? `${issue.path.join('.')} — ` : ''}${issue.message}`,
  ).join(' ')
}
