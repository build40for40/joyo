/**
 * The code half of each onboarding turn: find the birthplace, read dated events from the latest
 * answer, and score the day with the sky calculator. The model only explains what this finds.
 */
import type { Estimate, LifeEvent, Location, TurnRequest } from '../src/onboarding/schema'
import { MONTH_DATED_NEEDED, scoreDay, type DayScore, type ScoringEvent } from './sky/score'

/** The place the user picked, or the best match for what they typed. */
export async function resolveLocation(request: TurnRequest, search: (query: string) => Promise<Location[]>) {
  return request.birth.location ?? (await search(request.birth.place))[0] ?? null
}

/** A model-read event as dates the scoring can sample: a day, a month, a season or a year. */
export function toScoringEvent(event: LifeEvent, index: number): ScoringEvent | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(event.date)
  if (!match) return null
  const [, year, month, day] = match
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
  let start: string
  let end: string
  if (day && month) start = end = `${year}-${month}-${day}`
  else if (month && event.precision === 'season') {
    const from = new Date(Date.UTC(Number(year), Number(month) - 2, 1))
    const to = new Date(Date.UTC(Number(year), Number(month) + 1, 0))
    start = from.toISOString().slice(0, 10)
    end = to.toISOString().slice(0, 10)
  } else if (month) {
    start = `${year}-${month}-01`
    end = `${year}-${month}-${pad(lastDay(Number(year), Number(month)))}`
  } else {
    start = `${year}-01-01`
    end = `${year}-12-31`
  }
  const precision = day && month ? 'exact' : month ? (event.precision === 'season' ? 'season' : 'month') : 'year'
  return {
    id: String(index),
    kind: event.kind ?? 'other',
    about: event.about,
    start,
    end,
    precision,
    confidence: event.confidence,
  }
}

export function scoreEvents(request: TurnRequest, location: Location, events: LifeEvent[]): DayScore {
  return scoreDay({
    date: request.birth.date,
    place: location,
    timeOfDay: request.birth.timeOfDay,
    sureness: request.birth.sureness,
    events: events.flatMap((event, index) => toScoringEvent(event, index) ?? []),
  })
}

/** Events read from the newest answer, minus any the list already has. */
export function mergeEvents(known: LifeEvent[], found: LifeEvent[]) {
  const key = (e: LifeEvent) => `${e.kind}|${e.about}|${e.date}`
  const seen = new Set(known.map(key))
  return [...known, ...found.filter((e) => !seen.has(key(e)) && seen.add(key(e)))]
}

/** What the last answer did to the leading time, in plain words for the model and the screen. */
export function movement(before: DayScore | null, after: DayScore) {
  const lead = (s: DayScore | null) => s?.candidates[0]
  const was = lead(before)
  const now = lead(after)
  if (!now) return 'Nothing to score yet.'
  if (!was || !before?.counts.usable) return `First reading: ${now.lagna} rising leads, around ${now.bestMinute}.`
  if (was.lagna !== now.lagna || Math.abs(minutes(was.bestMinute) - minutes(now.bestMinute)) > 60)
    return `The lead moved from ${was.lagna} rising (around ${was.bestMinute}) to ${now.lagna} rising (around ${now.bestMinute}).`
  if (after.leaderMargin > before.leaderMargin + 0.01) return `${now.lagna} rising pulled further ahead, around ${now.bestMinute}.`
  if (after.leaderMargin < before.leaderMargin - 0.01) return `${now.lagna} rising still leads, but the gap closed.`
  return `No change: ${now.lagna} rising still leads, around ${now.bestMinute}.`
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** The scoring as the model sees it: numbers it must not change and reasons it can explain. */
export function scoringSummary(score: DayScore, events: LifeEvent[], location: Location) {
  const lines = [
    '## Scoring now',
    "The app's sidereal calculator worked this out in code. Never contradict it and never calculate anything yourself.",
    `- Birthplace used: ${location.label} (${location.tz}).`,
    `- Dated events: ${score.counts.month} of the ${MONTH_DATED_NEEDED} needed are dated to the month or better, ${score.counts.exact} to the day.`,
    `- Evidence level: ${score.level}. Confidence: ${score.confidence}.`,
    `- Leading rising signs: ${score.candidates
      .slice(0, 3)
      .map((c) => `${c.lagna} ${c.start}–${c.end} (best ${c.bestMinute})`)
      .join('; ')}. Lead over the next: ${Math.round(score.leaderMargin * 100)}%.`,
    score.range ? `- Range the evidence supports: ${score.range.start}–${score.range.end}, best ${score.bestTime}.` : '- No range yet: the evidence is not strong enough.',
  ]
  const notes = score.notes.map((note) => `  - ${events[Number(note.id)]?.type ?? 'an event'} (${events[Number(note.id)]?.date}): ${note.note}`)
  if (notes.length) lines.push('- Why each event does or does not fit the leading time, oldest answer first (the last ones came from the newest answer):', ...notes)
  if (score.disagreements.length) {
    lines.push(
      '- Periods where the top two times expect different things. Ask about these openly, without saying which time they favour:',
      ...score.disagreements.map((d) => `  - ${d.from} to ${d.to}: ${d.area}`),
    )
  }
  lines.push(
    "Write `note` as one short, warm sentence on what the user's last answer did, using the reasons for the newest events. If it added no dated event, say so kindly. Plain words; the Sanskrit term once in brackets at most.",
    'If you give the estimate now, copy earliest, latest, bestGuess and confidence from the final estimate line below.',
    `- Final estimate line: ${JSON.stringify(finalWindow(score))}`,
  )
  return lines.join('\n')
}

/** The estimate's window from the scoring. With too little evidence it is the leading sign's span, at low confidence. */
export function finalWindow(score: DayScore): Pick<Estimate, 'earliest' | 'latest' | 'bestGuess' | 'confidence' | 'window'> {
  const lead = score.candidates[0]
  const earliest = score.range?.start ?? lead?.start ?? '00:00'
  const latest = score.range?.end ?? lead?.end ?? '23:59'
  const bestGuess = score.bestTime ?? lead?.bestMinute ?? '12:00'
  const hour = Number(bestGuess.slice(0, 2))
  const window = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'night'
  return { earliest, latest, bestGuess, confidence: score.level === 'insufficient' ? 'low' : score.confidence, window }
}
