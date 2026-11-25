import type { Promotion, Transaction } from './model'

const promotionId = 'dad4edd7-5abe-4f66-abd3-61cb73eea2f3'
export const ruleId = '5d0246c2-4bc9-4e83-a59c-6243b9e028cd'

export function promotion(change: Partial<Promotion> = {}): Promotion {
  return {
    id: promotionId, bank: 'Example Bank', accountType: 'Checking', bonusCents: 30000,
    openedOn: '2026-02-27', qualificationDeadline: '2026-03-12', status: 'active',
    promoCode: '', terms: '', feeCents: 0, feeNotes: '', closureNotes: '', requirements: [], ...change,
  }
}

export function entry(change: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(), promotionId, date: '2026-03-04', amountCents: 20000,
    category: 'direct deposit', qualification: 'qualifying', note: '', ...change,
  }
}
