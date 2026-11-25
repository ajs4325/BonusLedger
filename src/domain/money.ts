import { cents } from './model'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
})

export function money(value: number, compact = false): string {
  const whole = Math.trunc(value / 100)
  const fraction = Math.abs(value % 100)
  const formatter = compact && fraction === 0 ? compactCurrency : currency
  return formatter.formatToParts(whole).map(part =>
    part.type === 'fraction' ? String(fraction).padStart(2, '0') : part.value,
  ).join('')
}

export function moneyInput(value?: number): string {
  if (value === undefined) return ''
  return `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}`
}

export function parseCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return Number.NaN
  const result = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return cents.safeParse(result).success ? result : Number.NaN
}
