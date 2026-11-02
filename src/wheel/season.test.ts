import { describe, expect, it } from 'vitest'

import type { OnboardingResult } from '@/onboarding/schema'
import { eventMs, houseFor, litMilestone, milestonesFrom, parseMilestone, seasonModel, seasonWord } from './season'

describe('houseFor', () => {
  it('maps life events to the house they speak to', () => {
    expect(houseFor('Married in a small ceremony')).toBe(7)
    expect(houseFor('First child')).toBe(5)
    expect(houseFor('Promoted to team lead')).toBe(10)
    expect(houseFor('Moved home')).toBe(4)
    expect(houseFor('Something unusual')).toBe(1)
  })
})

describe('eventMs', () => {
  it('places vague dates in the middle of their month or year', () => {
    expect(eventMs('2012-09-03')).toBe(Date.UTC(2012, 8, 3))
    expect(eventMs('2012-09')).toBe(Date.UTC(2012, 8, 15))
    expect(eventMs('2012')).toBe(Date.UTC(2012, 6, 1))
    expect(eventMs('sometime')).toBeNull()
  })
})

describe('parseMilestone', () => {
  it('reads a month and year and keeps the rest as the name', () => {
    expect(parseMilestone('Sold the company in March 2026')).toEqual({ name: 'Sold the company', date: '2026-03', house: 11 })
  })

  it('accepts a year on its own', () => {
    expect(parseMilestone('graduated 2009')).toMatchObject({ name: 'Graduated', date: '2009', house: 9 })
  })

  it('has no date when none is given', () => {
    expect(parseMilestone('Got married').date).toBeNull()
  })
})

describe('milestonesFrom', () => {
  it('turns onboarding events into days since birth, dropping ones it cannot place', () => {
    const result = {
      birth: { date: '1990-01-01', place: 'Testville', notes: '' },
      estimate: {
        events: [
          { type: 'marriage', date: '2015-06', precision: 'month', notes: '' },
          { type: 'first job', date: 'unknown', precision: 'year', notes: '' },
        ],
      },
    } as unknown as OnboardingResult
    expect(milestonesFrom(result)).toEqual([{ name: 'Marriage', t: 9296, house: 7 }])
  })
})

describe('seasonModel', () => {
  const model = seasonModel('1990-01-01|06:40')

  it('gives every house a score from 0 to 1', () => {
    const scores = model.scores(5000, [])
    expect(scores).toHaveLength(12)
    for (const score of scores) expect(score).toBeGreaterThanOrEqual(0)
    for (const score of scores) expect(score).toBeLessThanOrEqual(1)
  })

  it('is stable for the same person', () => {
    expect(seasonModel('1990-01-01|06:40').scores(5000, [])).toEqual(model.scores(5000, []))
  })

  it('keeps the 6th and 8th houses mid scale', () => {
    for (let t = 0; t < 20000; t += 97) {
      const scores = model.scores(t, [{ name: 'Change', t, house: 8 }])
      expect(scores[5]).toBeGreaterThanOrEqual(0.3)
      expect(scores[5]).toBeLessThanOrEqual(0.75)
      expect(scores[7]).toBeLessThanOrEqual(0.75)
    }
  })

  it('lifts a house around its milestone', () => {
    const without = model.scores(8000, [])[6]!
    const withMilestone = model.scores(8000, [{ name: 'Married', t: 8000, house: 7 }])[6]
    expect(withMilestone).toBeGreaterThan(without)
  })
})

describe('litMilestone', () => {
  it('picks the nearest milestone within reach', () => {
    const near = { name: 'Near', t: 1010, house: 1 }
    const far = { name: 'Far', t: 1100, house: 2 }
    expect(litMilestone(1000, [far, near])).toBe(near)
    expect(litMilestone(2000, [far, near])).toBeUndefined()
  })
})

describe('seasonWord', () => {
  it('describes the scale without fear words', () => {
    expect([0.1, 0.4, 0.5, 0.7, 0.9].map(seasonWord)).toEqual(['Resting', 'Quiet', 'Steady', 'Active', 'Peak'])
  })
})
