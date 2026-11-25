import { expect, test } from '@playwright/test'

test('launches a fresh demo and preserves changes across reloads', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('$875.00')).toBeVisible()

  await page.getByRole('button', { name: /Chase Total Checking/ }).click()
  await page.getByRole('button', { name: 'Edit promotion' }).click()
  await page.getByLabel('Bank name').fill('Updated demo bank')
  await page.getByRole('button', { name: 'Save promotion' }).click()
  await expect(page.getByRole('heading', { name: 'Updated demo bank' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Updated demo bank' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Promotions' }).click()
  await expect(page.getByRole('button', { name: /Updated demo bank Total Checking/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Chase Total Checking/ })).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('opens and migrates an existing personal database without replacing records', async ({ page }) => {
  await page.goto('./manifest.webmanifest')
  await page.evaluate(async () => {
    // Dexie stores schema version 1 as native IndexedDB version 10.
    const request = indexedDB.open('BonusLedger', 10)
    const promotionId = 'dad4edd7-5abe-4f66-abd3-61cb73eea2f3'
    request.onupgradeneeded = () => {
      const db = request.result
      const promotions = db.createObjectStore('promotions', { keyPath: 'id' })
      promotions.createIndex('status', 'status')
      promotions.add({
        id: promotionId, bank: 'Existing Bank', accountType: 'Checking', bonusCents: 30000,
        status: 'active', promoCode: '', terms: '', feeCents: 0, feeNotes: '',
        closureNotes: '', requirements: [],
      })
      const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
      transactions.createIndex('promotionId', 'promotionId')
      transactions.createIndex('date', 'date')
      transactions.add({
        id: '5d0246c2-4bc9-4e83-a59c-6243b9e028cd', promotionId, date: '2026-03-04',
        category: 'direct deposit', amountCents: 20000, note: 'Existing entry',
      })
      db.createObjectStore('settings', { keyPath: 'key' }).add({ key: 'theme', value: 'dark' })
    }
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
    localStorage.setItem('bonusledger-workspace', 'personal')
  })
  await page.goto('./')
  await expect(page.getByRole('button', { name: /Existing Bank Checking/ })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'Ledger', exact: true }).click()
  await expect(page.getByRole('button', { name: /Direct deposit.*Existing entry.*pending.*200.00/i })).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Open demo workspace' }).click()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByText('$875.00')).toBeVisible()
  await page.getByRole('button', { name: 'Use my ledger' }).click()
  await expect(page.getByRole('button', { name: /Existing Bank Checking/ })).toBeVisible()
})

test('identifies a demo write failure and can retry without clearing storage', async ({ page }) => {
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction
    let demoWritesBlocked = true
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      if (demoWritesBlocked && this.name === 'BonusLedgerDemo' && mode === 'readwrite') {
        throw new DOMException('Internal text should stay private', 'QuotaExceededError')
      }
      return transaction.call(this, stores, mode, options)
    }
    window.addEventListener('allow-demo-writes', () => {
      demoWritesBlocked = false
    }, { once: true })
  })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Couldn’t open the demo workspace' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('local storage is full')
  await page.getByText('Technical details').click()
  await expect(page.getByText('Preparing demo workspace', { exact: true })).toBeVisible()
  await expect(page.getByText('QuotaExceededError', { exact: true })).toBeVisible()
  await expect(page.getByText('Internal text should stay private')).toHaveCount(0)

  await page.evaluate(() => window.dispatchEvent(new Event('allow-demo-writes')))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('$875.00')).toBeVisible()
})

test('identifies a browser policy failure while opening the database and lets the personal ledger open', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (name, version) {
      if (name === 'BonusLedgerDemo') throw new DOMException('Browser policy', 'SecurityError')
      return open.call(this, name, version)
    }
  })
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('browser blocked the operation')
  await page.getByText('Technical details').click()
  await expect(page.getByText('Opening local database', { exact: true })).toBeVisible()
  await expect(page.getByText('SecurityError', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Use my ledger' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('No active promotions')).toBeVisible()
})
