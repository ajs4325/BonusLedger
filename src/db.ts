import Dexie, { type EntityTable } from 'dexie'
import { backupSchema, promotionSchema, transactionSchema, type Backup, type Promotion, type Theme, type Transaction } from './domain/model'
import { demoData } from './domain/demo'

interface Setting {
  key: 'theme' | 'demoInitialized'
  value: Theme | true
}

export class LedgerDatabase extends Dexie {
  promotions!: EntityTable<Promotion, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      promotions: 'id, status',
      transactions: 'id, promotionId, date',
      settings: 'key',
    })
    this.version(2).stores({
      promotions: 'id, status',
      transactions: 'id, promotionId, date, [promotionId+date]',
      settings: 'key',
    }).upgrade(tx => tx.table<Transaction>('transactions').toCollection().modify(entry => {
      entry.qualification ??= 'pending'
    }))
  }
}

export const personalDb = new LedgerDatabase('BonusLedger')
export const demoDb = new LedgerDatabase('BonusLedgerDemo')

export async function prepareDemo(db: LedgerDatabase, today: string) {
  await db.transaction('rw', db.promotions, db.transactions, db.settings, async () => {
    if (await db.settings.get('demoInitialized')) return
    const data = demoData(today)
    await db.promotions.bulkAdd(data.promotions)
    await db.transactions.bulkAdd(data.transactions)
    await db.settings.put({ key: 'demoInitialized', value: true })
  })
}

export async function loadLedger(db: LedgerDatabase) {
  return db.transaction('r', db.promotions, db.transactions, db.settings, async () => {
    const [promotions, transactions, theme] = await Promise.all([
      db.promotions.toArray(), db.transactions.toArray(), db.settings.get('theme'),
    ])
    return { promotions, transactions, theme: theme?.value === true ? 'system' : theme?.value ?? 'system' } as const
  })
}

export async function savePromotion(db: LedgerDatabase, row: Promotion, editing: boolean) {
  const promotion = promotionSchema.parse(row)
  await db.transaction('rw', db.promotions, async () => {
    if (editing) {
      if (!await db.promotions.get(promotion.id)) {
        throw new Error('This promotion was removed in another tab.')
      }
      await db.promotions.put(promotion)
    } else {
      await db.promotions.add(promotion)
    }
  })
}

export async function saveTransaction(db: LedgerDatabase, row: Transaction, editing: boolean) {
  const entry = transactionSchema.parse(row)
  await db.transaction('rw', db.promotions, db.transactions, async () => {
    if (!await db.promotions.get(entry.promotionId)) throw new Error('The linked promotion no longer exists.')
    if (editing) {
      if (!await db.transactions.get(entry.id)) {
        throw new Error('This ledger entry was removed in another tab.')
      }
      await db.transactions.put(entry)
    } else {
      await db.transactions.add(entry)
    }
  })
}

export async function deletePromotion(db: LedgerDatabase, id: string) {
  await db.transaction('rw', db.promotions, db.transactions, async () => {
    await db.transactions.where('promotionId').equals(id).delete()
    await db.promotions.delete(id)
  })
}

export async function exportBackup(db: LedgerDatabase): Promise<Backup> {
  const snapshot = await loadLedger(db)
  return backupSchema.parse({
    format: 'BonusLedger', version: 1, exportedAt: new Date().toISOString(), ...snapshot,
  })
}

export async function restoreBackup(db: LedgerDatabase, input: unknown) {
  const backup = backupSchema.parse(input)
  await db.transaction('rw', db.promotions, db.transactions, db.settings, async () => {
    await db.transactions.clear()
    await db.promotions.clear()
    await db.promotions.bulkAdd(backup.promotions)
    await db.transactions.bulkAdd(backup.transactions)
    await db.settings.put({ key: 'theme', value: backup.theme })
  })
}
