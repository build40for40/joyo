import type { Estimate } from '@/onboarding/schema'

/** The 12 fixed houses, house 1 first. Labels describe actions, never outcomes. */
export const HOUSES = [
  { action: 'Be yourself', name: 'Self' },
  { action: 'Build', name: 'Wealth' },
  { action: 'Speak up', name: 'Courage' },
  { action: 'Nest', name: 'Home' },
  { action: 'Create', name: 'Children' },
  { action: 'Do the work', name: 'Service' },
  { action: 'Partner', name: 'Marriage' },
  { action: 'Transform', name: 'Change' },
  { action: 'Learn', name: 'Fortune' },
  { action: 'Lead', name: 'Career' },
  { action: 'Connect', name: 'Gains' },
  { action: 'Let go', name: 'Release' },
] as const

/** The action label of a house, numbered 1 to 12. */
export const houseAction = (house: number) => HOUSES[house - 1]?.action ?? ''

export const DAY_MS = 86_400_000

/** How far either side of a milestone it lights up its house, in days. */
export const MILESTONE_REACH = 120

export interface Milestone {
  name: string
  /** Days since birth. */
  t: number
  /** 1 to 12. */
  house: number
  /** Set when added on the wheel after onboarding, so it can be removed. */
  id?: string
}

const HOUSE_KEYWORDS: [RegExp, number][] = [
  [/marri|wedding|engag|divorc|separat|partner|spouse|husband|wife/i, 7],
  [/child|baby|son\b|daughter|pregnan|birth of/i, 5],
  [/sold|acqui|exit|profit|gain|investor|raised|friend|community/i, 11],
  [/job|promot|career|company|business|founded|startup|role|hired|fired|redundan|work/i, 10],
  [/abroad|emigra|overseas|visa|foreign|retire/i, 12],
  [/moved|move|house|home|flat|property|mortgage/i, 4],
  [/degree|graduat|universit|college|school|phd|master|course|teacher|pilgrim|faith|father/i, 9],
  [/sibling|brother|sister|wrote|publish|launch|podcast|travel/i, 3],
  [/money|savings|inherit|bought|loan|debt|family/i, 2],
  [/ill|surgery|hospital|diagnos|health|injur/i, 6],
  [/loss|passed|died|death|accident|lost/i, 8],
]

/** The house a life event most speaks to, from its wording. Falls back to house 1. */
export function houseFor(text: string) {
  return HOUSE_KEYWORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 1
}

export function birthMs(date: string) {
  return Date.parse(`${date}T00:00:00Z`)
}

/** YYYY, YYYY-MM or YYYY-MM-DD as UTC ms, at the middle of the month or year when vaguer. */
export function eventMs(date: string): number | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(date)
  if (!match) return null
  const [, year, month, day] = match
  if (!month) return Date.UTC(Number(year), 6, 1)
  return Date.UTC(Number(year), +month - 1, day ? +day : 15)
}

/** Onboarding events as milestones, measured from the birth date. Events before it are left out. */
export function milestonesFrom(events: Estimate['events'], birthDate: string): Milestone[] {
  const birth = birthMs(birthDate)
  return events.flatMap((event) => {
    const at = eventMs(event.date)
    if (at === null || at < birth) return []
    return [{ name: capitalise(event.type), t: Math.round((at - birth) / DAY_MS), house: houseFor(event.type) }]
  })
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Reads a typed milestone like "Sold the company in March 2026". The date is null when there isn't one. */
export function parseMilestone(text: string): { name: string; date: string | null; house: number } {
  const monthYear = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+((?:19|20)\d{2})\b/i.exec(text)
  const yearOnly = monthYear ? null : /\b(?:19|20)\d{2}\b/.exec(text)
  const found = monthYear ?? yearOnly
  const date = monthYear
    ? `${monthYear[2]}-${String(MONTHS.indexOf(monthYear[1]!.toLowerCase()) + 1).padStart(2, '0')}`
    : yearOnly?.[0] ?? null
  let name = found ? text.replace(found[0], '') : text
  name = name
    .replace(/\b(in|on|during|around|back in)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;]+$/, '')
  if (name.length > 40) name = `${name.slice(0, 39)}…`
  return { name: capitalise(name) || 'Milestone', date, house: houseFor(text) }
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A small seeded random number generator, so each person's wheel is stable between visits. */
function random(seedText: string) {
  let seed = 0
  for (const char of seedText) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = (x: number, width: number) => Math.exp(-((x / width) ** 2) / 2)

export interface SeasonModel {
  /** 0 (resting) to 1 (active) for each house, on the given day since birth. */
  scores(t: number, milestones: readonly Milestone[]): number[]
}

/**
 * A placeholder season model: slow seeded cycles per house, lifted around the user's milestones.
 * It stands in until the rectification tools give real dasha and transit data.
 */
export function seasonModel(seedText: string): SeasonModel {
  const next = random(seedText)
  const cycles = HOUSES.map(() => ({
    slow: 900 + next() * 2600,
    slowPhase: next() * Math.PI * 2,
    fast: 300 + next() * 500,
    fastPhase: next() * Math.PI * 2,
  }))
  return {
    scores(t, milestones) {
      return cycles.map((cycle, index) => {
        let value =
          0.5 +
          0.38 * Math.sin((Math.PI * 2 * t) / cycle.slow + cycle.slowPhase) +
          0.14 * Math.sin((Math.PI * 2 * t) / cycle.fast + cycle.fastPhase)
        for (const milestone of milestones) {
          if (milestone.house === index + 1) value += 0.55 * gauss(t - milestone.t, 90)
        }
        value = Math.min(1, Math.max(0, value))
        // The 6th and 8th houses stay mid scale, so they never read as a stark low or high.
        return index === 5 || index === 7 ? 0.3 + 0.45 * value : value
      })
    },
  }
}

export function seasonWord(value = 0) {
  if (value > 0.8) return 'Peak'
  if (value > 0.62) return 'Active'
  if (value > 0.45) return 'Steady'
  if (value > 0.28) return 'Quiet'
  return 'Resting'
}

/** The milestone close enough to light up its house on this day, if any. */
export function litMilestone(t: number, milestones: readonly Milestone[]) {
  let best: Milestone | undefined
  for (const milestone of milestones) {
    const distance = Math.abs(t - milestone.t)
    if (distance < MILESTONE_REACH && (!best || distance < Math.abs(t - best.t))) best = milestone
  }
  return best
}

export function formatMonth(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatDay(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A span of months, like "Mar–Jun 2027" or "Oct 2028–Jan 2029". */
export function formatRange(startMs: number, endMs: number) {
  const start = new Date(startMs)
  const end = new Date(endMs)
  const month = (date: Date) => date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return `${formatMonth(startMs)}–${formatMonth(endMs)}`
  if (start.getUTCMonth() === end.getUTCMonth()) return formatMonth(startMs)
  return `${month(start)}–${month(end)} ${end.getUTCFullYear()}`
}
