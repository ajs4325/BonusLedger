import { addDays } from './dates'
import type { Deadline } from './dashboard'

function escapeText(value: string) {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[;,]/g, '\\$&')
}

function fold(line: string) {
  const encoder = new TextEncoder()
  let output = ''
  let bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (bytes + size > 75) {
      output += '\r\n '
      bytes = 1
    }
    output += character
    bytes += size
  }
  return output
}

export function createIcs(items: Deadline[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const compact = (date: string) => date.replaceAll('-', '')
  const events = items.flatMap(item => [
    'BEGIN:VEVENT',
    `UID:${item.id}@bonusledger.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(item.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(item.date, 1))}`,
    `SUMMARY:${escapeText(`${item.bank} — ${item.title}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(item.title)}`,
    'END:VALARM', 'END:VEVENT',
  ])
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BonusLedger//Deadlines//EN',
    'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].map(fold).join('\r\n')
}
