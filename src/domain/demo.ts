import { addDays } from './dates'
import type { Promotion, Transaction } from './model'

export function demoData(today: string) {
  const day = (offset: number) => addDays(today, offset)
  const defaults = { promoCode: '', terms: '', feeCents: 0, feeNotes: '', closureNotes: '', requirements: [] }
  const chase: Promotion = {
    ...defaults, id: crypto.randomUUID(), bank: 'Chase', accountType: 'Total Checking',
    bonusCents: 30000, status: 'active', openedOn: day(-16), qualificationDeadline: day(8),
    payoutMinDays: 0, payoutMaxDays: 15, terms: 'Sample offer for exploring BonusLedger.',
    requirements: [
      { id: crypto.randomUUID(), title: 'Reach $500 in direct deposits', type: 'direct deposits', targetCents: 50000, deadline: day(5) },
      { id: crypto.randomUUID(), title: 'Enroll in paperless statements', type: 'checklist', completedDate: day(-15) },
    ],
  }
  const capital: Promotion = {
    ...defaults, id: crypto.randomUUID(), bank: 'Capital One', accountType: '360 Checking',
    bonusCents: 25000, status: 'active', openedOn: day(-12), qualificationDeadline: day(15),
    requirements: [
      { id: crypto.randomUUID(), title: 'Make two deposits of $500', type: 'deposit count', targetCount: 2, minimumCents: 50000 },
    ],
  }
  const wells: Promotion = {
    ...defaults, id: crypto.randomUUID(), bank: 'Wells Fargo', accountType: 'Everyday Checking',
    bonusCents: 32500, status: 'awaiting payout', openedOn: day(-35), qualifiedOn: day(-8), payoutMinDays: 10, payoutMaxDays: 30,
    requirements: [
      { id: crypto.randomUUID(), title: 'Reach $1,000 in direct deposits', type: 'direct deposits', targetCents: 100000 },
    ],
  }
  const discover: Promotion = {
    ...defaults, id: crypto.randomUUID(), bank: 'Discover', accountType: 'Online Savings',
    bonusCents: 20000, status: 'paid', openedOn: day(-63), receivedOn: day(-21), receivedCents: 20000,
    closureOn: day(27),
  }

  const transactions: Transaction[] = [
    { id: crypto.randomUUID(), promotionId: chase.id, date: day(-4), amountCents: 30000, category: 'direct deposit', qualification: 'qualifying', note: 'Sample payroll deposit' },
    { id: crypto.randomUUID(), promotionId: capital.id, date: day(-8), amountCents: 55000, category: 'direct deposit', qualification: 'qualifying', note: 'First deposit' },
    { id: crypto.randomUUID(), promotionId: wells.id, date: day(-8), amountCents: 100000, category: 'direct deposit', qualification: 'qualifying', note: '' },
  ]

  return { promotions: [chase, capital, wells, discover], transactions }
}
