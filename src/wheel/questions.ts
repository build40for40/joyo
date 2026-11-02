import { HOUSES, seasonWord, type Milestone, type SeasonModel } from './season'

/** The big-moment questions people bring to a Jyotish reading, and the houses each one reads. */
export const QUESTIONS = [
  {
    key: 'marriage',
    label: 'Marriage',
    ask: 'When is a good time to marry?',
    houses: [7],
    support: [2, 11],
    words: /marr|wedding|engag|partner|spouse|propos/i,
  },
  {
    key: 'home',
    label: 'Buy a home',
    ask: 'When is a good time to buy a home?',
    houses: [4],
    support: [2, 11],
    words: /home|house|flat|apartment|property|mortgage|move in/i,
  },
  {
    key: 'career',
    label: 'Change jobs',
    ask: 'When is a good time to change jobs?',
    houses: [10],
    support: [6, 11],
    words: /job|career|work|promot|role|quit|resign|hired/i,
  },
  {
    key: 'business',
    label: 'Start a business',
    ask: 'When is a good time to start a business?',
    houses: [10],
    support: [7, 3, 11],
    words: /business|company|startup|found|launch|venture/i,
  },
  {
    key: 'abroad',
    label: 'Move countries',
    ask: 'When is a good time to move countries?',
    houses: [12],
    support: [9, 4],
    words: /abroad|countr|emigra|overseas|visa|relocat|foreign/i,
  },
  {
    key: 'children',
    label: 'Have a child',
    ask: 'When is a good time to have a child?',
    houses: [5],
    support: [9],
    words: /child|baby|pregnan|kids|family/i,
  },
  {
    key: 'study',
    label: 'Study',
    ask: 'When is a good time to study?',
    houses: [9],
    support: [4, 5],
    words: /stud|degree|course|universit|college|school|learn|exam/i,
  },
  {
    key: 'money',
    label: 'Invest or save',
    ask: 'When is a good time to invest or save?',
    houses: [2],
    support: [11],
    words: /money|invest|sav|financ|wealth|stock|buy shares/i,
  },
  {
    key: 'challenge',
    label: 'Take on a challenge',
    ask: 'When is a good time to take on a big challenge?',
    // House 3 for courage and effort, 1 for body and energy, 6 for training and discipline.
    houses: [3],
    support: [1, 6],
    words: /marathon|race|running|\brun\b|triathlon|ironman|compet|tournament|match|climb|trek|sport|challenge/i,
  },
  {
    key: 'health',
    label: 'Health',
    ask: 'When is a good time to focus on my health?',
    // House 6 for habits and getting better, 1 for energy and body, 12 for rest and recovery. Never house 8.
    houses: [6],
    support: [1, 12],
    words: /health|surgery|operation|treatment|fitness|diet|exercise|recover|wellbeing|well-being|doctor/i,
  },
] as const

export type Question = (typeof QUESTIONS)[number]

/** The question a typed text is closest to, if any. */
export function matchQuestion(text: string) {
  return QUESTIONS.find((question) => question.words.test(text))
}

export interface SeasonWindow {
  /** Days since birth. */
  start: number
  end: number
  /** The day the season is strongest. */
  peak: number
  value: number
  strongest: boolean
  /** Why the window fits, in plain words. */
  why: string
}

export interface Reading {
  question: Question
  /** The question's season on any day since birth, 0 to 1, for drawing its strip. */
  at(t: number): number
  /** The best future windows, in date order. */
  windows: SeasonWindow[]
  /** A quieter stretch soon, better for planning than big steps. */
  quiet: { start: number; end: number } | null
  /** Past milestones that speak to the question. */
  matches: Milestone[]
}

const STEP = 7
const MAX_WINDOWS = 3
/** Peaks closer than this count as one season. */
const MIN_GAP = 365
/** A window covers the days around its peak that are nearly as strong. */
const NEAR_PEAK = 0.06
/** Windows are looked for this far ahead, so answers stay about the next few years. */
const HORIZON = 5 * 365
/** A window reaches at most this far either side of its peak, so it names a season, not an era. */
const HALF_WIDTH = 91
const QUIET_REACH = 3 * 365

/** A question's season on a day: its main houses count three times as much as the supporting ones. */
function themeScore(scores: number[], question: Question) {
  let total = 0
  let weight = 0
  for (const house of question.houses) (total += 3 * (scores[house - 1] ?? 0)), (weight += 3)
  for (const house of question.support) (total += scores[house - 1] ?? 0), (weight += 1)
  return total / weight
}

/** Contiguous stretches where a sampled value passes a test, with each one's strongest day. */
function runs(samples: { t: number; value: number }[], pass: (value: number) => boolean) {
  const found: { start: number; end: number; peak: number; value: number }[] = []
  let current: (typeof found)[number] | null = null
  for (const sample of samples) {
    if (pass(sample.value)) {
      current ??= { start: sample.t, end: sample.t, peak: sample.t, value: sample.value }
      current.end = sample.t
      if (sample.value > current.value) Object.assign(current, { peak: sample.t, value: sample.value })
    } else if (current) {
      found.push(current)
      current = null
    }
  }
  if (current) found.push(current)
  return found
}

function explain(scores: number[], question: Question) {
  const [main] = question.houses
  const supporting = [...question.support].sort((a, b) => (scores[b - 1] ?? 0) - (scores[a - 1] ?? 0))[0]
  const mainText = `${HOUSES[main - 1]!.action} is ${seasonWord(scores[main - 1]).toLowerCase()}`
  if (!supporting) return `${mainText}.`
  return `${mainText}, with ${HOUSES[supporting - 1]!.action} ${seasonWord(scores[supporting - 1]).toLowerCase()} alongside.`
}

/**
 * Reads a question's seasons from the model: the strip for the timeline,
 * the best windows in the next few years and a quiet stretch soon.
 */
export function readSeasons(
  model: SeasonModel,
  milestones: readonly Milestone[],
  question: Question,
  today: number,
  span: number,
): Reading {
  const at = (t: number) => themeScore(model.scores(t, milestones), question)

  const future: { t: number; value: number }[] = []
  for (let t = today; t <= Math.min(span, today + HORIZON); t += STEP) future.push({ t, value: at(t) })
  // The strongest peaks at least MIN_GAP apart, each with its main house at least steady.
  // The first one always counts, so there's always an answer.
  const mainSteady = (t: number) =>
    question.houses.every((house) => (model.scores(t, milestones)[house - 1] ?? 0) > 0.45)
  const peaks: number[] = []
  for (const index of future.map((_, i) => i).sort((a, b) => future[b]!.value - future[a]!.value)) {
    if (peaks.length === MAX_WINDOWS) break
    const sample = future[index]!
    if (peaks.length && sample.value < 0.5) break
    if (peaks.length && !mainSteady(sample.t)) continue
    if (peaks.every((peak) => Math.abs(future[peak]!.t - sample.t) >= MIN_GAP)) peaks.push(index)
  }

  const windows = peaks
    .map((index, rank) => {
      const peak = future[index]!
      let first = index
      let last = index
      while (first > 0 && future[first - 1]!.value >= peak.value - NEAR_PEAK) first--
      while (last < future.length - 1 && future[last + 1]!.value >= peak.value - NEAR_PEAK) last++
      return {
        start: Math.max(future[first]!.t, peak.t - HALF_WIDTH),
        end: Math.min(future[last]!.t, peak.t + HALF_WIDTH),
        peak: peak.t,
        value: peak.value,
        strongest: rank === 0,
        why: explain(model.scores(peak.t, milestones), question),
      }
    })
    .sort((a, b) => a.start - b.start)

  const soon = future.filter((sample) => sample.t <= today + QUIET_REACH)
  const quiet =
    runs(soon, (value) => value < 0.4)
      .filter((run) => run.end - run.start >= 60)
      .sort((a, b) => b.end - b.start - (a.end - a.start))[0] ?? null

  const main: readonly number[] = question.houses
  const matches = milestones.filter((milestone) => milestone.t <= today && main.includes(milestone.house))

  return { question, at, windows, quiet: quiet && { start: quiet.start, end: quiet.end }, matches }
}
