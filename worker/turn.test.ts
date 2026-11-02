import { describe, expect, it } from 'vitest'

import type { LifeEvent, TurnRequest } from '../src/onboarding/schema'
import { finalWindow, mergeEvents, movement, scoreEvents, scoringSummary, toScoringEvent } from './turn'

const event = (date: string, precision: LifeEvent['precision'], kind: LifeEvent['kind'] = 'job_start'): LifeEvent => ({
  kind,
  type: 'started a job',
  about: 'self',
  date,
  precision,
  confidence: 'high',
  notes: '',
})

const location = { label: 'Testville', lat: 51.5, lon: -0.13, tz: 'Europe/London' }
const turn: TurnRequest = {
  birth: { date: '1990-04-17', place: 'Testville', location, timeOfDay: 'unknown', sureness: 'not_sure', notes: '' },
  steps: [],
  events: [],
  finish: false,
}

describe('toScoringEvent', () => {
  it('turns days, months, seasons and years into date ranges', () => {
    expect(toScoringEvent(event('2015-05-13', 'exact'), 0)).toMatchObject({ start: '2015-05-13', end: '2015-05-13', precision: 'exact' })
    expect(toScoringEvent(event('2016-02', 'month'), 1)).toMatchObject({ start: '2016-02-01', end: '2016-02-29', precision: 'month' })
    expect(toScoringEvent(event('2016-07', 'season'), 2)).toMatchObject({ start: '2016-06-01', end: '2016-08-31', precision: 'season' })
    expect(toScoringEvent(event('2008', 'year'), 3)).toMatchObject({ start: '2008-01-01', end: '2008-12-31', precision: 'year' })
  })

  it('skips dates it cannot read', () => {
    expect(toScoringEvent(event('around then', 'year'), 0)).toBeNull()
  })
})

describe('mergeEvents', () => {
  it('adds only events it has not seen', () => {
    const known = [event('2008-07', 'month')]
    expect(mergeEvents(known, [event('2008-07', 'month'), event('2010-10-11', 'exact')])).toHaveLength(2)
  })
})

describe('a scored turn', () => {
  const events = [
    event('2008-07', 'month'),
    event('2010-10-11', 'exact'),
    event('2015-08-16', 'exact', 'move_abroad'),
    event('2004-10-01', 'exact', 'study_start'),
  ]
  const score = scoreEvents(turn, location, events)

  it('takes the final window from the scoring, at low confidence when evidence is short', () => {
    expect(score.level).toBe('insufficient')
    expect(finalWindow(score)).toMatchObject({ confidence: 'low', bestGuess: score.candidates[0]!.bestMinute })
  })

  it('tells the model the numbers and never to compute them', () => {
    const summary = scoringSummary(score, events, location)
    expect(summary).toContain('Never contradict it and never calculate anything yourself')
    expect(summary).toContain('4 of the 6 needed')
    expect(summary).toContain('Final estimate line')
  })

  it('describes what an answer did to the lead', () => {
    expect(movement(null, score)).toMatch(/^First reading/)
    expect(movement(score, score)).toMatch(/^No change/)
  })
})
