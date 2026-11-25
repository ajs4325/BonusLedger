import { daysBetween } from './dates'
import type { Promotion, Requirement, Transaction } from './model'

export function effectiveDeadline(requirement: Requirement, promotion: Promotion): string | undefined {
  const { deadline } = requirement
  const { qualificationDeadline } = promotion
  if (deadline && qualificationDeadline) return deadline < qualificationDeadline ? deadline : qualificationDeadline
  return deadline ?? qualificationDeadline
}

export function requirementProgress(
  rule: Requirement, promotion: Promotion, transactions: Transaction[], today: string,
) {
  const deadline = effectiveDeadline(rule, promotion)
  const through = deadline && deadline < today ? deadline : today
  let current = 0
  let target = 1
  let unit: 'cents' | 'count' | 'days' | 'check' = 'count'
  const entries = [...new Map(transactions.filter(entry => entry.promotionId === promotion.id &&
    entry.qualification === 'qualifying' && entry.date <= through &&
    (!promotion.openedOn || entry.date >= promotion.openedOn),
  ).map(entry => [entry.id, entry])).values()]

  switch (rule.type) {
    case 'direct deposits':
      current = entries.reduce((sum, entry) => sum + (entry.category === 'direct deposit' ? entry.amountCents : 0), 0)
      target = rule.targetCents
      unit = 'cents'
      break
    case 'deposit count':
    case 'debit transactions':
      current = entries.filter(entry => entry.amountCents >= rule.minimumCents &&
        (rule.type === 'deposit count'
          ? entry.category === 'deposit' || entry.category === 'direct deposit'
          : entry.category === 'debit purchase')).length
      target = rule.targetCount
      break
    case 'minimum balance': {
      const snapshots = entries.filter(entry => entry.category === 'balance snapshot')
      const latest = snapshots.reduce((day, entry) => entry.date > day ? entry.date : day, '')
      const balances = snapshots.filter(entry => entry.date === latest).map(entry => entry.amountCents)
      current = balances.length ? Math.min(...balances) : 0
      target = rule.targetCents
      unit = 'cents'
      break
    }
    case 'holding period': {
      const start = rule.startDate
      current = start && (!promotion.openedOn || start >= promotion.openedOn)
        ? Math.max(0, daysBetween(start, through)) : 0
      target = rule.targetDays
      unit = 'days'
      break
    }
    case 'checklist':
      current = rule.completedDate && rule.completedDate <= through &&
        (!promotion.openedOn || rule.completedDate >= promotion.openedOn) ? 1 : 0
      unit = 'check'
      break
  }

  return { current, target, unit, ratio: Math.min(1, current / target), complete: current >= target }
}

export function promotionProgress(promotion: Promotion, transactions: Transaction[], today: string) {
  const rules = promotion.requirements.map(rule => ({
    ...requirementProgress(rule, promotion, transactions, today), rule,
  }))
  return {
    rules,
    complete: rules.filter(rule => rule.complete).length,
    ratio: rules.length ? rules.reduce((sum, rule) => sum + rule.ratio, 0) / rules.length : 0,
  }
}
