const dayMs = 86_400_000
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function localDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function utc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function addDays(date: string, days: number): string {
  return new Date(utc(date) + days * dayMs).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return (utc(to) - utc(from)) / dayMs
}

export function formatDate(value: string, includeYear = false): string {
  return (includeYear ? longDate : shortDate).format(utc(value))
}

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(utc(`${month}-01`))
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(utc(`${month}-01`))
}

export function calendarDays(month: string): string[] {
  const start = `${month}-01`
  const leading = new Date(utc(start)).getUTCDay()
  return Array.from({ length: 42 }, (_, index) => addDays(start, index - leading))
}
