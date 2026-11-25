import { describe, expect, it } from 'vitest'
import { entry, promotion, ruleId } from './fixtures.test-helper'
import { effectiveDeadline, promotionProgress, requirementProgress } from './progress'
import type { Requirement } from './model'

const today = '2026-03-15'
const rule = { id: ruleId, title: 'Make deposits' }
const offer = promotion()

describe('requirement progress', () => {
  it('counts each qualifying direct deposit once inside the inclusive window', () => {
    const initial = entry({ date: '2026-02-27' })
    const end = entry({ date: '2026-03-05', amountCents: 30123 })
    const transactions = [initial, initial, end, entry({ date: '2026-03-06' }),
      entry({ date: '2026-02-26' }), entry({ qualification: 'pending' }),
      entry({ qualification: 'excluded' }), entry({ promotionId: crypto.randomUUID() }),
      entry({ category: 'deposit' })]
    const result = requirementProgress({ ...rule, type: 'direct deposits', targetCents: 50000, deadline: '2026-03-05' }, offer, transactions, today)
    expect(result).toMatchObject({ current: 50123, complete: true, ratio: 1 })
  })

  it('honors independent deadlines and the overall qualification cutoff', () => {
    const transactions = [entry({ date: '2026-03-04' }), entry({ date: '2026-03-10' }), entry({ date: '2026-03-13' })]
    const early = { ...rule, type: 'deposit count', targetCount: 2, minimumCents: 0, deadline: '2026-03-07' } as const
    const late = { ...early, id: crypto.randomUUID(), deadline: '2026-03-20' }
    expect(effectiveDeadline(late, offer)).toBe('2026-03-12')
    expect(requirementProgress(early, offer, transactions, today).current).toBe(1)
    expect(requirementProgress(late, offer, transactions, today).current).toBe(2)
    expect(requirementProgress(late, offer, transactions, '2026-03-07').current).toBe(1)
  })

  it('counts deposit and debit categories independently and checks the minimum', () => {
    const transactions = [entry(), entry({ category: 'deposit' }),
      entry({ category: 'deposit', amountCents: 99 }), entry({ category: 'debit purchase', amountCents: 100 })]
    expect(requirementProgress({ ...rule, type: 'deposit count', targetCount: 3, minimumCents: 100 }, offer, transactions, today).current).toBe(2)
    expect(requirementProgress({ ...rule, type: 'debit transactions', targetCount: 2, minimumCents: 100 }, offer, transactions, today).current).toBe(1)
  })

  it('uses the lowest snapshot from the latest documented day', () => {
    const snapshot = { ...rule, type: 'minimum balance', targetCents: 50000 } as const
    const balance = (date: string, amountCents: number) => entry({ category: 'balance snapshot', date, amountCents })
    const transactions = [balance('2026-03-01', 60000), balance('2026-03-12', 55000),
      balance('2026-03-12', 0), balance('2026-03-13', 80000)]
    expect(requirementProgress(snapshot, offer, transactions, today)).toMatchObject({ current: 0, complete: false })
    expect(requirementProgress(snapshot, offer, transactions, '2026-03-02')).toMatchObject({ current: 60000, complete: true })
  })

  it('counts elapsed holding days across DST and ignores late checklist completion', () => {
    const hold: Requirement = { ...rule, type: 'holding period', targetDays: 5, startDate: '2026-03-07' }
    const check: Requirement = { ...rule, id: crypto.randomUUID(), type: 'checklist', completedDate: '2026-03-13' }
    const result = promotionProgress({ ...offer, requirements: [hold, check] }, [], today)
    expect(result.rules.map(row => row.current)).toEqual([5, 0])
    expect(result).toMatchObject({ complete: 1, ratio: .5 })
    expect(requirementProgress({ ...hold, startDate: undefined }, offer, [], today).current).toBe(0)
  })
})
