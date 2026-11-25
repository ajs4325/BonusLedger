import type { Promotion, Transaction } from './model'
import { addDays } from './dates'
import { effectiveDeadline, promotionProgress } from './progress'

export const activeStatuses: Promotion['status'][] = ['active', 'qualified', 'awaiting payout']

export function financialTotals(promotions: Promotion[], today: string) {
  let potential = 0
  let received = 0
  let active = 0
  for (const promotion of promotions) {
    const recorded = Boolean(promotion.receivedOn)
    if (recorded && promotion.receivedOn! <= today) received += promotion.receivedCents ?? 0
    if (!recorded && (promotion.status === 'considering' || activeStatuses.includes(promotion.status))) {
      potential += promotion.bonusCents
    }
    if (activeStatuses.includes(promotion.status)) active++
  }
  return { potential, received, active }
}

export interface Deadline {
  id: string
  promotionId: string
  bank: string
  title: string
  date: string
  kind: 'requirement' | 'qualification' | 'payout' | 'closure' | 'holding'
}

export function deadlines(promotions: Promotion[], transactions: Transaction[], today: string): Deadline[] {
  const result: Deadline[] = []
  for (const promotion of promotions) {
    if (['closed', 'expired', 'abandoned'].includes(promotion.status)) continue
    const add = (suffix: string, title: string, date: string, kind: Deadline['kind']) => {
      result.push({ id: `${promotion.id}-${suffix}`, promotionId: promotion.id, bank: promotion.bank, title, date, kind })
    }
    if (['active', 'considering'].includes(promotion.status)) {
      if (promotion.qualificationDeadline) add('qualification', 'Qualification deadline', promotion.qualificationDeadline, 'qualification')
      for (const { rule, complete } of promotionProgress(promotion, transactions, today).rules) {
        if (complete) continue
        const due = effectiveDeadline(rule, promotion)
        if (due && rule.deadline) add(rule.id, rule.title, due, 'requirement')
        if (rule.type === 'holding period' && rule.startDate) {
          const end = addDays(rule.startDate, rule.targetDays)
          if (!due || end <= due) add(`${rule.id}-hold`, `${rule.title} ends`, end, 'holding')
        }
      }
    }
    if (promotion.qualifiedOn && !promotion.receivedOn && ['qualified', 'awaiting payout'].includes(promotion.status)) {
      const { payoutMinDays, payoutMaxDays } = promotion
      if (payoutMinDays !== undefined && payoutMinDays !== payoutMaxDays) {
        add('payout-open', 'Payout window opens', addDays(promotion.qualifiedOn, payoutMinDays), 'payout')
      }
      if (payoutMaxDays !== undefined) {
        add('payout-close', 'Expected payout by', addDays(promotion.qualifiedOn, payoutMaxDays), 'payout')
      }
    }
    if (promotion.closureOn) add('closure', 'Earliest closure date', promotion.closureOn, 'closure')
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

export function tasks(promotions: Promotion[], transactions: Transaction[], today: string) {
  return promotions.flatMap(promotion => {
    if (promotion.status !== 'active') return []
    const { rules } = promotionProgress(promotion, transactions, today)
    if (rules.length && rules.every(rule => rule.complete)) {
      return [{ id: promotion.id, promotionId: promotion.id, bank: promotion.bank, title: 'Review qualification', date: promotion.qualificationDeadline }]
    }
    return rules.filter(rule => !rule.complete).map(({ rule }) => ({
      id: rule.id, promotionId: promotion.id, bank: promotion.bank,
      title: rule.title, date: effectiveDeadline(rule, promotion),
    }))
  }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
}
