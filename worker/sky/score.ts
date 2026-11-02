/**
 * Scores every birth time of a day against dated life events, following the rules in
 * src/rectification/system-prompt.md. A port of tools/rectification-test/rectify.py, tested against
 * its scores in scoring-reference.json. The model never does any of this: it only explains the result.
 */
import { localDay, localToUtc, utcToLocal } from './time'
import {
  ascendant,
  chartFrom,
  DRISHTI,
  GRAHAS,
  grahaLongitudes,
  lagnaSpans,
  LORDS,
  RASHIS,
  type Chart,
  type Graha,
  type Place,
  type Varga,
} from './vedic'

export const EVENT_KINDS = [
  'relationship_start',
  'marriage',
  'relationship_end',
  'child_born',
  'job_start',
  'job_end',
  'study_start',
  'study_end',
  'school_change',
  'home_move',
  'property',
  'move_abroad',
  'own_health',
  'money',
  'spiritual',
  'media',
  'parent_health',
  'parent_death',
  'parent_money',
  'sibling_born',
  'sibling_married',
  'sibling_child',
  'grandparent_death',
  'other',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const EVENT_ABOUT = ['self', 'father', 'mother', 'sibling', 'grandparent', 'other'] as const
export type EventAbout = (typeof EVENT_ABOUT)[number]

export interface ScoringEvent {
  id: string
  kind: EventKind
  about: EventAbout
  /** Local dates, YYYY-MM-DD. The same date twice for an exact event. */
  start: string
  end: string
  precision: 'exact' | 'month' | 'season' | 'year'
  confidence: 'high' | 'medium' | 'low'
}

interface Significators {
  bhavas: number[]
  karakas: Graha[]
  varga: Varga | null
}

const sig = (bhavas: number[], karakas: Graha[] = [], varga: Varga | null = null): Significators => ({ bhavas, karakas, varga })

/** Bhavas, karakas and varga for each kind of event: the master prompt's Stage 0 table. Null is not scored. */
export function significators(kind: EventKind, about: EventAbout): Significators | null {
  const mother = about === 'mother'
  switch (kind) {
    case 'relationship_start':
    case 'marriage':
      return sig([7], ['Shukra'], 9)
    case 'relationship_end':
      return sig([7, 6], ['Shukra'], 9)
    case 'child_born':
      return sig([5], ['Guru'], 7)
    case 'job_start':
    case 'job_end':
      return sig([10], ['Shani', 'Surya', 'Budha'], 10)
    case 'study_start':
    case 'study_end':
      return sig([9, 5], ['Budha', 'Guru'])
    case 'school_change':
      return sig([4], ['Budha'])
    case 'home_move':
    case 'property':
      return sig([4], ['Mangala', 'Chandra'])
    case 'move_abroad':
      return sig([12, 9], ['Rahu'])
    case 'own_health':
      return sig([6, 8, 1], ['Mangala', 'Shani'])
    case 'money':
      return sig([2, 11, 8], ['Guru'])
    case 'spiritual':
      return sig([9, 12, 5], ['Guru', 'Ketu'])
    case 'media':
      return sig([3, 10], ['Budha'], 10)
    // A parent's house, and the houses counted from it: the 6th for illness, the marakas for death,
    // the 2nd and 12th for money.
    case 'parent_health':
      return mother ? sig([4, 9], ['Chandra'], 12) : sig([9, 2], ['Surya'], 12)
    case 'parent_death':
      return mother ? sig([4, 5, 10], ['Chandra'], 12) : sig([9, 10, 3], ['Surya'], 12)
    case 'parent_money':
      return mother ? sig([5, 3], ['Chandra'], 12) : sig([10, 8], ['Surya'], 12)
    // Younger siblings are the 3rd house and elder the 11th; their events count from there.
    case 'sibling_born':
      return sig([3], ['Mangala'])
    case 'sibling_married':
      return sig([9, 5], ['Mangala'])
    case 'sibling_child':
      return sig([7, 3], ['Mangala'])
    case 'grandparent_death':
      return sig([7, 12, 5], [], 12)
    case 'other':
      return null
  }
}

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.6, low: 0.3 } as const
const YEAR_MS = 365.25 * 86_400_000
const NAKSHATRA = 360 / 27
const DASHA_ORDER: readonly Graha[] = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangala', 'Rahu', 'Guru', 'Shani', 'Budha']
const DASHA_YEARS: Record<string, number> = { Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangala: 7, Rahu: 18, Guru: 16, Shani: 19, Budha: 17 }

/** Maha, Antar and Pratyantar lords running at a date, walked straight from the Moon at birth. */
export function dashaLordsAt(moon: number, birthMs: number, atMs: number): [Graha, Graha, Graha] {
  const first = Math.floor(moon / NAKSHATRA) % 9
  const elapsed = (moon % NAKSHATRA) / NAKSHATRA
  let start = birthMs - elapsed * DASHA_YEARS[DASHA_ORDER[first]!]! * YEAR_MS
  let index = first
  let years = 120
  const lords: Graha[] = []
  for (let level = 0; level < 3; level++) {
    for (let k = 0; ; k++) {
      const i = (index + k) % 9
      const lord = DASHA_ORDER[i]!
      const span = level === 0 ? DASHA_YEARS[lord]! : (years * DASHA_YEARS[lord]!) / 120
      if (atMs < start + span * YEAR_MS || k > 30) {
        lords.push(lord)
        index = i
        years = span
        break
      }
      start += span * YEAR_MS
    }
  }
  return lords as [Graha, Graha, Graha]
}

type Link = 'karaka' | 'lord' | 'occupant' | 'aspect'

/** How a graha ties to any of the bhavas from a varga lagna, if it does. */
function link(graha: Graha, bhavas: number[], chart: Chart, d: Varga, karakas: readonly Graha[], strict: boolean) {
  if (karakas.includes(graha)) return { how: 'karaka' as Link, house: bhavas[0]! }
  const lagna = chart.lagna[d]
  const sign = chart.signs[d][graha]
  for (const house of bhavas) {
    const target = (lagna + house - 1) % 12
    if (LORDS[target] === graha) return { how: 'lord' as Link, house }
    if (sign === target) return { how: 'occupant' as Link, house }
    if (!strict && (DRISHTI[graha] ?? [7]).includes(((target - sign + 12) % 12) + 1)) return { how: 'aspect' as Link, house }
  }
  return null
}

function transitHits(sign: number, graha: 'Shani' | 'Guru', target: number) {
  return sign === target || DRISHTI[graha]!.includes(((target - sign + 12) % 12) + 1)
}

/** Local midnights sampled monthly across an event's dates, as the Python harness does. */
function sampleDates(event: ScoringEvent, tz: string) {
  const day = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  const out: number[] = []
  for (let t = day(event.start); t <= day(event.end); t += 30 * 86_400_000) {
    out.push(localToUtc(`${new Date(t).toISOString().slice(0, 10)}T00:00`, tz))
    if (event.start === event.end) break
  }
  return out
}

/** Shani and Guru's sidereal signs on each sampled date, which don't depend on the birth time. */
export class Transits {
  private cache = new Map<number, { Shani: number; Guru: number }>()
  at(utcMs: number) {
    let signs = this.cache.get(utcMs)
    if (!signs) {
      const longitudes = grahaLongitudes(utcMs)
      signs = { Shani: Math.floor(longitudes.Shani / 30), Guru: Math.floor(longitudes.Guru / 30) }
      this.cache.set(utcMs, signs)
    }
    return signs
  }
}

interface PreparedEvent extends ScoringEvent {
  signif: Significators
  dates: number[]
  weight: number
}

export function prepareEvents(events: ScoringEvent[], tz: string): PreparedEvent[] {
  return events.flatMap((event) => {
    const signif = significators(event.kind, event.about)
    if (!signif) return []
    return [{ ...event, signif, dates: sampleDates(event, tz), weight: CONFIDENCE_WEIGHT[event.confidence] }]
  })
}

/** One event's score at one sampled date, by the prompt's Stage 1 rules. */
function scoreOnDate(chart: Chart, birthMs: number, event: PreparedEvent, at: number, transits: Transits) {
  const { bhavas, karakas, varga } = event.signif
  const strict = event.about !== 'self'
  const [md, ad, pd] = dashaLordsAt(chart.longitudes.Chandra, birthMs, at)
  const mdLink = link(md, bhavas, chart, 1, karakas, strict)
  const adLink = link(ad, bhavas, chart, 1, karakas, strict)
  let score = 1.5 * Number(!!mdLink) + 1.5 * Number(!!adLink)
  if (varga && (link(md, bhavas, chart, varga, [], strict) || link(ad, bhavas, chart, varga, [], strict))) score += 1
  if (link(pd, bhavas, chart, 1, karakas, strict)) score += 1
  if (!mdLink && !adLink) score -= 2
  const signs = transits.at(at)
  const hits = (base: number) =>
    (['Shani', 'Guru'] as const).map((g) => bhavas.some((house) => transitHits(signs[g], g, (base + house - 1) % 12)))
  const fromLagna = hits(chart.lagna[1])
  if (fromLagna.every(Boolean)) score += 2
  else if (fromLagna.some(Boolean) || hits(chart.signs[1].Chandra).some(Boolean)) score += 1
  return { score, md, ad, mdLink, adLink }
}

export function scoreEvent(chart: Chart, birthMs: number, event: PreparedEvent, transits: Transits) {
  const total = event.dates.reduce((sum, at) => sum + scoreOnDate(chart, birthMs, event, at, transits).score, 0)
  return (total / event.dates.length) * event.weight
}

/** Each kind of event counts once: average within a kind, then add the kinds. */
function balancedTotal(events: PreparedEvent[], scores: number[]) {
  const byKind = new Map<string, number[]>()
  events.forEach((event, index) => {
    const key = `${event.kind}:${event.about}`
    byKind.set(key, [...(byKind.get(key) ?? []), scores[index]!])
  })
  let total = 0
  for (const kindScores of byKind.values()) total += kindScores.reduce((a, b) => a + b, 0) / kindScores.length
  return total
}

/** Graha longitudes across a day every 30 minutes, interpolated between: they move slowly enough. */
class DayPositions {
  private knots: { t: number; longitudes: Record<Graha, number> }[] = []
  constructor(start: number, end: number) {
    for (let t = start; t <= end + 1_800_000; t += 1_800_000) this.knots.push({ t, longitudes: grahaLongitudes(t) })
  }
  at(t: number): Record<Graha, number> {
    const i = Math.min(Math.max(0, Math.floor((t - this.knots[0]!.t) / 1_800_000)), this.knots.length - 2)
    const a = this.knots[i]!
    const b = this.knots[i + 1]!
    const f = (t - a.t) / (b.t - a.t)
    return Object.fromEntries(
      GRAHAS.map((g) => {
        const delta = ((b.longitudes[g] - a.longitudes[g] + 540) % 360) - 180
        return [g, (a.longitudes[g] + f * delta + 360) % 360]
      }),
    ) as Record<Graha, number>
  }
}

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night', 'unknown'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]
export type Sureness = 'sure' | 'fairly_sure' | 'not_sure'

/** Local clock hours each family memory covers. Night wraps past midnight. */
const HINT_HOURS: Record<Exclude<TimeOfDay, 'unknown'>, [number, number]> = {
  morning: [5, 12],
  afternoon: [12, 17],
  evening: [17, 22],
  night: [22, 5],
}
const HINT_SHARE: Record<Sureness, number> = { sure: 0.1, fairly_sure: 0.05, not_sure: 0 }

function inHint(local: string, timeOfDay: TimeOfDay) {
  if (timeOfDay === 'unknown') return false
  const hour = Number(local.slice(11, 13)) + Number(local.slice(14, 16)) / 60
  const [from, to] = HINT_HOURS[timeOfDay]
  return from < to ? hour >= from && hour < to : hour >= from || hour < to
}

export type EvidenceLevel = 'insufficient' | 'lagna' | 'varga' | 'minute'

export function evidenceCounts(events: ScoringEvent[]) {
  const usable = events.filter((e) => e.confidence !== 'low' && significators(e.kind, e.about))
  const exact = usable.filter((e) => e.precision === 'exact').length
  const month = usable.filter((e) => e.precision === 'exact' || e.precision === 'month').length
  const years = usable.map((e) => Number(e.start.slice(0, 4)))
  const spreadYears = years.length ? Math.max(...years) - Math.min(...years) : 0
  return { exact, month, usable: usable.length, spreadYears }
}

/** The master prompt's evidence levels: how far the dates allow the result to narrow. */
export function evidenceLevel({ exact, month, usable, spreadYears }: ReturnType<typeof evidenceCounts>): EvidenceLevel {
  if (month < 6) return 'insufficient'
  if (exact >= 6 && exact * 2 >= usable && spreadYears >= 20) return 'minute'
  if (exact >= 4) return 'varga'
  return 'lagna'
}

/** A clear leader beats the runner-up by this share of its score. */
export const CLEAR_MARGIN = 0.08
export const MONTH_DATED_NEEDED = 6

export interface ScoringInput {
  date: string
  place: Place
  timeOfDay: TimeOfDay
  sureness: Sureness
  events: ScoringEvent[]
}

export interface Candidate {
  lagna: (typeof RASHIS)[number]
  start: string
  end: string
  bestMinute: string
  score: number
  scoreWithoutHint: number
}

export interface EventNote {
  id: string
  score: number
  fits: boolean
  note: string
}

export interface DayScore {
  level: EvidenceLevel
  counts: ReturnType<typeof evidenceCounts>
  candidates: Candidate[]
  leaderMargin: number
  clearLeader: boolean
  /** Local HH:MM, null when the evidence is insufficient. */
  bestTime: string | null
  range: { start: string; end: string } | null
  confidence: 'low' | 'medium' | 'high'
  boundary: boolean
  dependsOnHint: boolean
  /** Every 5 minutes of the local day, 0 to 1. */
  likelihood: { time: string; score: number }[]
  /** Why each event does or doesn't fit the leading time. */
  notes: EventNote[]
}

const SCAN_STEP = 120_000
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

function describeLink(graha: Graha, l: { how: Link; house: number }) {
  if (l.how === 'karaka') return `${graha} is the natural significator for it`
  if (l.how === 'lord') return `${graha} rules your ${ORDINAL[l.house]} house`
  if (l.how === 'occupant') return `${graha} sits in your ${ORDINAL[l.house]} house`
  return `${graha} aspects your ${ORDINAL[l.house]} house`
}

function noteFor(chart: Chart, birthMs: number, event: PreparedEvent, transits: Transits, score: number): EventNote {
  const at = event.dates[Math.floor(event.dates.length / 2)]!
  const { md, ad, mdLink, adLink } = scoreOnDate(chart, birthMs, event, at, transits)
  const period = `${md}–${ad} period`
  const reason = adLink ? describeLink(ad, adLink) : mdLink ? describeLink(md, mdLink) : null
  const houses = event.signif.bhavas.map((h) => ORDINAL[h]).join(' or ')
  return {
    id: event.id,
    score,
    fits: !!reason,
    note: reason
      ? `It fell in the ${period}, and ${reason}.`
      : `It fell in the ${period}, and neither ${md} nor ${ad} connects to your ${houses} house.`,
  }
}

/** Scores the whole calendar day of birth, every 2 minutes, and ranks the rising signs by their best minute. */
export function scoreDay(input: ScoringInput): DayScore {
  const { place } = input
  const { start, end } = localDay(input.date, place.tz)
  const events = prepareEvents(input.events, place.tz)
  const positions = new DayPositions(start, end)
  const transits = new Transits()

  const samples: { t: number; local: string; raw: number; chart: Chart; sign: number }[] = []
  for (let t = start; t < end; t += SCAN_STEP) {
    const chart = chartFrom(t, ascendant(t, place), positions.at(t))
    const raw = events.length ? balancedTotal(events, events.map((e) => scoreEvent(chart, t, e, transits))) : 0
    samples.push({ t, local: utcToLocal(t, place.tz), raw, chart, sign: chart.lagna[1] })
  }

  const top = Math.max(...samples.map((s) => s.raw))
  const bonus = Math.max(top, 0) * HINT_SHARE[input.sureness]
  const scored = samples.map((s) => ({ ...s, score: s.raw + (inHint(s.local, input.timeOfDay) ? bonus : 0) }))

  const spans = lagnaSpans(start, end, place)
  const ranked = spans
    .map((span) => {
      const inside = scored.filter((s) => s.t >= span.start && s.t < span.end)
      const best = inside.reduce((a, b) => (b.score > a.score ? b : a), inside[0] ?? scored[0]!)
      const bestRaw = Math.max(...inside.map((s) => s.raw), best.raw)
      return { span, inside, best, bestRaw }
    })
    .filter((c) => c.inside.length)
    .sort((a, b) => b.best.score - a.best.score)

  const toCandidate = (c: (typeof ranked)[number]): Candidate => ({
    lagna: c.span.rashi,
    start: utcToLocal(c.span.start, place.tz).slice(11, 16),
    end: utcToLocal(c.span.end, place.tz).slice(11, 16),
    bestMinute: c.best.local.slice(11, 16),
    score: round(c.best.score),
    scoreWithoutHint: round(c.bestRaw),
  })

  const leader = ranked[0]!
  const runnerUp = ranked[1]
  const leaderMargin = runnerUp ? (leader.best.score - runnerUp.best.score) / Math.max(Math.abs(leader.best.score), 1) : 1
  const clearLeader = events.length > 0 && leaderMargin >= CLEAR_MARGIN
  const counts = evidenceCounts(input.events)
  const level: EvidenceLevel = clearLeader ? evidenceLevel(counts) : 'insufficient'

  const rawLeader = [...ranked].sort((a, b) => b.bestRaw - a.bestRaw)[0]!
  const dependsOnHint = bonus > 0 && rawLeader.span !== leader.span

  let range: DayScore['range'] = null
  if (level === 'lagna') range = { start: toCandidate(leader).start, end: toCandidate(leader).end }
  if (level === 'varga' || level === 'minute') {
    const tolerance = level === 'minute' ? 1 : 2
    const near = leader.inside.filter((s) => s.score >= leader.best.score - tolerance)
    range = { start: near[0]!.local.slice(11, 16), end: near[near.length - 1]!.local.slice(11, 16) }
  }

  const boundary = Math.min(leader.best.t - leader.span.start, leader.span.end - leader.best.t) <= 5 * 60_000
  const confidence = level === 'minute' && leaderMargin >= 0.15 ? 'high' : level === 'varga' || level === 'minute' ? 'medium' : 'low'

  const low = Math.min(...scored.map((s) => s.score))
  const high = Math.max(...scored.map((s) => s.score))
  const likelihood = scored
    .filter((s) => (s.t - start) % 300_000 < SCAN_STEP)
    .map((s) => ({ time: s.local.slice(11, 16), score: high > low ? round((s.score - low) / (high - low)) : 0 }))

  const leaderChart = leader.best.chart
  const notes = events.map((e) => noteFor(leaderChart, leader.best.t, e, transits, round(scoreEvent(leaderChart, leader.best.t, e, transits))))

  return {
    level,
    counts,
    candidates: (level === 'insufficient' ? ranked.filter((c) => c.best.score >= leader.best.score * 0.85) : ranked).map(toCandidate),
    leaderMargin: round(leaderMargin),
    clearLeader,
    bestTime: level === 'insufficient' ? null : leader.best.local.slice(11, 16),
    range,
    confidence,
    boundary,
    dependsOnHint,
    likelihood,
    notes,
  }
}

const round = (n: number) => Math.round(n * 100) / 100
