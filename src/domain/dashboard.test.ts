import { describe, expect, it } from 'vitest'
import { addDays, calendarDays, daysBetween, localDate } from './dates'
import { deadlines, financialTotals, tasks } from './dashboard'
import { createIcs } from './ics'
import { money, parseCents } from './money'
import { entry, promotion, ruleId } from './fixtures.test-helper'

describe('dates and deadlines', () => {
  it('uses local calendar components and crosses DST, leap days, and year boundaries', () => {
    expect(localDate(new Date(2026, 2, 8, 23, 45))).toBe('2026-03-08')
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(calendarDays('2026-03')).toHaveLength(42)
    expect(calendarDays('2026-03')[0]).toBe('2026-03-01')
  })

  it('shows incomplete requirements, closure, and payout bounds while skipping closed promotions', () => {
    const live = promotion({ closureOn: '2026-04-01', requirements: [
      { id: ruleId, type: 'direct deposits', title: 'Direct deposits', deadline: '2026-03-07', targetCents: 50000 },
      { id: crypto.randomUUID(), type: 'checklist', title: 'Enroll', completedDate: '2026-03-01', deadline: '2026-03-06' },
    ] })
    const payout = promotion({ id: crypto.randomUUID(), status: 'awaiting payout', qualifiedOn: '2026-03-05', payoutMinDays: 3, payoutMaxDays: 15 })
    const closed = promotion({ id: crypto.randomUUID(), status: 'closed', closureOn: '2026-04-01' })
    const items = deadlines([live, payout, closed], [entry()], '2026-03-08')
    expect(items.map(item => [item.kind, item.date])).toEqual([
      ['requirement', '2026-03-07'], ['payout', '2026-03-08'], ['qualification', '2026-03-12'],
      ['payout', '2026-03-20'], ['closure', '2026-04-01'],
    ])
    expect(tasks([live], [entry({ amountCents: 50000 })], '2026-03-08').map(item => item.title)).toEqual(['Review qualification'])
  })

  it('includes both the holding end and independent deadline', () => {
    const item = promotion({ requirements: [
      { id: ruleId, type: 'holding period', title: 'Hold funds', startDate: '2026-03-01', targetDays: 3, deadline: '2026-03-06' },
    ] })
    expect(deadlines([item], [], '2026-03-03').map(event => [event.kind, event.date])).toEqual([
      ['holding', '2026-03-04'], ['requirement', '2026-03-06'], ['qualification', '2026-03-12'],
    ])
  })

  it('exports all-day events and a one-day alarm with escaped, byte-folded content', () => {
    const item = { id: 'a', promotionId: 'b', bank: 'A, B; C', title: 'Keep funds\n' + 'é'.repeat(80), date: '2026-03-08', kind: 'holding' } as const
    const ics = createIcs([item], new Date('2026-03-01T22:31:12Z'))
    expect(ics).toContain('DTSTAMP:20260301T223112Z\r\nDTSTART;VALUE=DATE:20260308\r\nDTEND;VALUE=DATE:20260309')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics.replaceAll('\r\n ', '')).toContain('A\\, B\\; C — Keep funds\\n')
    expect(ics.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })
})

describe('financial totals', () => {
  it('adds outstanding offers and actual receipts in cents, including receipts on closed offers', () => {
    const items = [
      promotion({ status: 'active', bonusCents: 10001 }),
      promotion({ status: 'considering', bonusCents: 10002 }),
      promotion({ status: 'qualified', bonusCents: 10003 }),
      promotion({ status: 'awaiting payout', bonusCents: 10004 }),
      promotion({ status: 'closed', receivedOn: '2026-03-03', receivedCents: 9999 }),
      promotion({ status: 'paid', receivedOn: '2026-03-04', receivedCents: 5001 }),
      promotion({ status: 'expired', bonusCents: 99999 }),
      promotion({ status: 'abandoned', bonusCents: 99999 }),
    ]
    expect(financialTotals(items, '2026-03-15')).toEqual({ potential: 40010, received: 15000, active: 3 })
  })

  it('parses and renders amounts exactly and rejects invalid input', () => {
    expect(parseCents('0.29')).toBe(29)
    expect(parseCents('999999999.99')).toBe(99999999999)
    expect(money(99999999999)).toBe('$999,999,999.99')
    expect(money(29, true)).toBe('$0.29')
    expect(money(50000, true)).toBe('$500')
    for (const invalid of ['NaN', '1.234', '-1', '1,000', '3e2', '', '1000000000']) {
      expect(parseCents(invalid)).toBeNaN()
    }
  })
})
