import { describe, expect, it } from 'vitest'

import { dashaLordsAt, prepareEvents, scoreDay, scoreEvent, significators, Transits, type ScoringEvent } from './score'
import reference from './scoring-reference.json'
import { localToUtc } from './time'
import { computeChart, dashaAt, dashaTimeline } from './vedic'

type Persona = (typeof reference.personas)[number]

const toEvent = (e: Persona['events'][number]) => ({ ...e }) as ScoringEvent
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

describe('dashaLordsAt', () => {
  it('agrees with the full Vimshottari timeline', () => {
    const { place, true: local } = reference.personas[0]!
    const birth = localToUtc(local, place.tz)
    const chart = computeChart(birth, place)
    const timeline = dashaTimeline(chart)
    for (let years = 1; years < 60; years += 1.37) {
      const at = birth + years * 365.25 * 86_400_000
      expect(dashaLordsAt(chart.longitudes.Chandra, birth, at)).toEqual(dashaAt(timeline, at).lords)
    }
  })
})

describe('significators', () => {
  it('maps each kind to its houses and leaves "other" unscored', () => {
    expect(significators('marriage', 'self')).toMatchObject({ bhavas: [7], varga: 9 })
    expect(significators('parent_health', 'father')?.bhavas).toEqual([9, 2])
    expect(significators('parent_health', 'mother')?.bhavas).toEqual([4, 9])
    expect(significators('other', 'other')).toBeNull()
  })
})

describe.each(reference.personas)('$name', (persona) => {
  const { place } = persona
  const events = persona.events.map(toEvent)

  it("scores the person's own events like the Python harness", () => {
    // Events about other people follow a stricter rule here than in the harness, so only own events compare.
    const own = prepareEvents(events.filter((e) => e.about === 'self'), place.tz)
    let compared = 0
    let mismatched = 0
    for (const sample of persona.scores) {
      const birth = localToUtc(sample.local, place.tz)
      const chart = computeChart(birth, place)
      const transits = new Transits()
      for (const event of own) {
        const expected = (sample.events as Record<string, number>)[event.id]!
        compared++
        if (Math.abs(scoreEvent(chart, birth, event, transits) - expected) > 1e-6) mismatched++
      }
    }
    // The engines may only disagree where a graha or the lagna sits arcseconds from a sign edge.
    expect(mismatched / compared).toBeLessThanOrEqual(0.01)
  })

  const result = scoreDay({ date: persona.true.slice(0, 10), place, timeOfDay: 'unknown', sureness: 'not_sure', events })
  const truth = minutes(persona.true.slice(11, 16))

  it('returns a likelihood for every 5 minutes and a note for every event', () => {
    expect(result.likelihood).toHaveLength(288)
    expect(result.notes).toHaveLength(events.length)
  })

  it('never claims a range that misses the true time', () => {
    if (!result.range) return expect(result.level).toBe('insufficient')
    expect(truth).toBeGreaterThanOrEqual(minutes(result.range.start) - 4)
    expect(truth).toBeLessThanOrEqual(minutes(result.range.end) + 4)
  })
})

describe('scoreDay', () => {
  const persona = reference.personas[0]!
  const base = { date: persona.true.slice(0, 10), place: persona.place, events: persona.events.map(toEvent) }

  it('says insufficient with no events', () => {
    const result = scoreDay({ ...base, events: [], timeOfDay: 'unknown', sureness: 'not_sure' })
    expect(result.level).toBe('insufficient')
    expect(result.bestTime).toBeNull()
  })

  it('gives a sure family memory a bonus of at most 10%, and an unsure one none', () => {
    const unsure = scoreDay({ ...base, timeOfDay: 'night', sureness: 'not_sure' })
    const sure = scoreDay({ ...base, timeOfDay: 'night', sureness: 'sure' })
    for (const candidate of sure.candidates) {
      expect(candidate.score - candidate.scoreWithoutHint).toBeLessThanOrEqual(Math.max(...unsure.candidates.map((c) => c.score)) * 0.1 + 0.01)
    }
    for (const candidate of unsure.candidates) expect(candidate.score).toBe(candidate.scoreWithoutHint)
  })
})
