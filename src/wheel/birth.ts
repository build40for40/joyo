import type { Estimate } from '@/onboarding/schema'

/** Written sources a birth time can come from. A family memory isn't one: it guides the estimate, never replaces it. */
export const RECORD_SOURCES = {
  certificate: 'birth certificate',
  hospital: 'hospital record',
  kundli: 'kundli',
  diary: 'family diary',
} as const

export type RecordSource = keyof typeof RECORD_SOURCES

/** A birth time found written down after onboarding. It replaces the estimate. Kept in the browser for now. */
export interface BirthRecord {
  /** YYYY-MM-DD. */
  date: string
  /** HH:MM, local time where they were born. */
  time: string
  source: RecordSource
}

const key = (completedAt: string) => `joyo:birth-record:${completedAt}`

export function loadBirthRecord(completedAt: string): BirthRecord | null {
  try {
    const saved = localStorage.getItem(key(completedAt))
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export function saveBirthRecord(completedAt: string, record: BirthRecord | null) {
  try {
    if (record) localStorage.setItem(key(completedAt), JSON.stringify(record))
    else localStorage.removeItem(key(completedAt))
  } catch {}
}

const minutes = (time: string) => {
  const [hours = 0, mins = 0] = time.split(':').map(Number)
  return hours * 60 + mins
}

/** Whether a recorded time falls outside the estimated window, which may run past midnight. */
export function outsideWindow(time: string, { earliest, latest }: Pick<Estimate, 'earliest' | 'latest'>) {
  const at = minutes(time)
  const from = minutes(earliest)
  const to = minutes(latest)
  return from <= to ? at < from || at > to : at < from && at > to
}
