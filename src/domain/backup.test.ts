import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { LedgerDatabase, deletePromotion, exportBackup, prepareDemo, restoreBackup, savePromotion, saveTransaction } from '../db'
import { backupSchema, type Backup } from './model'
import { entry, promotion, ruleId } from './fixtures.test-helper'

function backup(): Backup {
  return {
    format: 'BonusLedger', version: 1, exportedAt: '2026-03-15T00:00:00Z',
    promotions: [promotion()], transactions: [entry()], theme: 'dark',
  }
}

describe('backup validation', () => {
  it('accepts supported data and rejects unknown versions, structures, and extra fields', () => {
    const value = backup()
    expect(backupSchema.parse(JSON.parse(JSON.stringify(value)))).toEqual(value)
    expect(backupSchema.safeParse({ ...value, version: 2 }).success).toBe(false)
    expect(backupSchema.safeParse({ ...value, theme: 'purple' }).success).toBe(false)
    expect(backupSchema.safeParse({ ...value, accounts: [] }).success).toBe(false)
  })

  it('rejects invalid money, dates, payout ranges, and unsafe URLs', () => {
    for (const changed of [
      { bonusCents: 1500.25 }, { qualificationDeadline: '2026-02-30' },
      { offerUrl: 'javascript:alert(1)' }, { offerUrl: 'https://name:secret@example.com' }, { payoutMinDays: 50, payoutMaxDays: 15 },
      { status: 'paid' }, { closureOn: '2026-02-26' },
    ]) {
      expect(backupSchema.safeParse({ ...backup(), promotions: [promotion(changed as Partial<ReturnType<typeof promotion>>)] }).success).toBe(false)
    }
  })

  it('rejects orphans and duplicate record and requirement IDs', () => {
    const value = backup()
    const rule = { id: ruleId, type: 'checklist', title: 'Enroll' } as const
    expect(backupSchema.safeParse({ ...value, promotions: [] }).success).toBe(false)
    expect(backupSchema.safeParse({ ...value, promotions: [...value.promotions, ...value.promotions] }).success).toBe(false)
    expect(backupSchema.safeParse({ ...value, transactions: [...value.transactions, ...value.transactions] }).success).toBe(false)
    expect(backupSchema.safeParse({ ...value, promotions: [promotion({ requirements: [rule, rule] })] }).success).toBe(false)
  })
})

describe('IndexedDB persistence', () => {
  const open: LedgerDatabase[] = []
  const newDb = () => {
    const db = new LedgerDatabase(crypto.randomUUID())
    open.push(db)
    return db
  }

  afterEach(async () => {
    await Promise.all(open.splice(0).map(db => db.delete()))
  })

  it('validates before overwriting, and replaces a full snapshot', async () => {
    const db = newDb()
    const value = backup()
    await restoreBackup(db, value)
    await expect(restoreBackup(db, { ...value, promotions: [] })).rejects.toThrow()
    expect(await exportBackup(db)).toMatchObject({ promotions: value.promotions, transactions: value.transactions, theme: 'dark' })
    await restoreBackup(db, { ...value, promotions: [], transactions: [], theme: 'light' })
    expect(await exportBackup(db)).toMatchObject({ promotions: [], transactions: [], theme: 'light' })
  })

  it('saves edits and deletes linked entries, preventing stale edits from creating orphans', async () => {
    const db = newDb()
    const item = promotion({ offerUrl: 'https://example.com' })
    const transaction = entry()
    await savePromotion(db, item, false)
    await savePromotion(db, { ...item, bank: 'Changed', offerUrl: undefined }, true)
    expect(await db.promotions.get(item.id)).toMatchObject({ bank: 'Changed', offerUrl: undefined })
    await saveTransaction(db, transaction, false)
    await saveTransaction(db, { ...transaction, amountCents: 100 }, true)
    expect((await db.transactions.get(transaction.id))?.amountCents).toBe(100)
    await deletePromotion(db, item.id)
    expect(await db.transactions.count()).toBe(0)
    await expect(saveTransaction(db, transaction, true)).rejects.toThrow('no longer exists')
    await expect(savePromotion(db, item, true)).rejects.toThrow('removed')
  })

  it('runs the v1-to-v2 migration and preserves records', async () => {
    const db = newDb()
    const legacy = new Dexie(db.name)
    legacy.version(1).stores({ promotions: 'id, status', transactions: 'id, promotionId, date', settings: 'key' })
    const row = { ...entry(), qualification: undefined }
    await legacy.table('promotions').add(promotion())
    await legacy.table('transactions').add(row)
    legacy.close()
    expect(await db.transactions.get(row.id)).toMatchObject({ qualification: 'pending' })
    expect(await db.promotions.count()).toBe(1)
  })

  it('seeds demo records only once, even across simultaneous opens', async () => {
    const db = newDb()
    await Promise.all([prepareDemo(db, '2026-03-03'), prepareDemo(db, '2026-03-03')])
    expect(await db.promotions.count()).toBe(4)
    expect(await db.transactions.count()).toBe(3)
  })
})
