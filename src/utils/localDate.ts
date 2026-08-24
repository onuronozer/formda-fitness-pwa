const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function toLocalDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function assertLocalDate(value: string): string {
  if (!LOCAL_DATE_PATTERN.test(value)) throw new Error('Geçersiz yerel tarih.')
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Geçersiz yerel tarih.')
  return value
}

export function shiftLocalDate(localDate: string, days: number): string {
  assertLocalDate(localDate)
  const date = new Date(`${localDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function localDateTimeToIso(localDate: string, time: string): string {
  assertLocalDate(localDate)
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Geçersiz saat.')
  const date = new Date(`${localDate}T${time}:00`)
  if (Number.isNaN(date.getTime())) throw new Error('Geçersiz tarih veya saat.')
  return date.toISOString()
}

export function isoToLocalTime(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
