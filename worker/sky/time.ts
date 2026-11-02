/** Local wall-clock times at the place of birth, as `YYYY-MM-DDTHH:mm[:ss]` with no offset. */
export type LocalDateTime = string

const MINUTE = 60_000

function partsAt(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Minutes the zone is ahead of UTC at that instant, from tzdata, so historical DST rules apply. */
function offsetMinutes(utcMs: number, timeZone: string) {
  const p = partsAt(utcMs, timeZone)
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000) / MINUTE
}

function wallClockMs(local: LocalDateTime) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!match) throw new Error(`Not a local date and time: ${local}`)
  const [y, mo, d, h, mi, s] = match.slice(1).map((part) => Number(part ?? 0))
  return Date.UTC(y!, mo! - 1, d!, h!, mi!, s!)
}

/** The UTC instant of a local clock time in a time zone. */
export function localToUtc(local: LocalDateTime, timeZone: string): number {
  const wall = wallClockMs(local)
  const first = wall - offsetMinutes(wall, timeZone) * MINUTE
  const second = wall - offsetMinutes(first, timeZone) * MINUTE
  return second
}

/** The local clock time of a UTC instant, to the second. */
export function utcToLocal(utcMs: number, timeZone: string): LocalDateTime {
  const p = partsAt(utcMs, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

/** UTC instants of local midnight at the start and end of a calendar date. */
export function localDay(date: string, timeZone: string) {
  const start = localToUtc(`${date}T00:00`, timeZone)
  const next = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 1))
  return { start, end: localToUtc(`${next.toISOString().slice(0, 10)}T00:00`, timeZone) }
}
