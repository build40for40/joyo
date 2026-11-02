import { describe, expect, it } from 'vitest'

import { matchQuestion, QUESTIONS, readSeasons } from './questions'
import { seasonModel } from './season'

const marriage = QUESTIONS.find((question) => question.key === 'marriage')!

describe('matchQuestion', () => {
  it('maps common questions to the houses they read', () => {
    expect(matchQuestion('When should I get married?')?.key).toBe('marriage')
    expect(matchQuestion('Is next year good to buy a house?')?.key).toBe('home')
    expect(matchQuestion('Should I change jobs?')?.key).toBe('career')
    expect(matchQuestion('Should I move abroad?')?.key).toBe('abroad')
    expect(matchQuestion('When should I plan my surgery?')?.key).toBe('health')
    expect(matchQuestion('When should I run a marathon?')?.key).toBe('challenge')
    expect(matchQuestion('What colour is the sky?')).toBeUndefined()
  })

  it('never reads house 8 for health', () => {
    const health = QUESTIONS.find((question) => question.key === 'health')!
    expect([...health.houses, ...health.support]).not.toContain(8)
  })
})

describe('readSeasons', () => {
  const model = seasonModel('1990-01-01|06:40')
  const today = 13000
  const span = today + 4383
  const married = { name: 'Married', t: 9000, house: 7 }
  const reading = readSeasons(model, [married], marriage, today, span)

  it('finds up to three future windows in date order, one of them strongest', () => {
    expect(reading.windows.length).toBeGreaterThan(0)
    expect(reading.windows.length).toBeLessThanOrEqual(3)
    expect(reading.windows.filter((window) => window.strongest)).toHaveLength(1)
    for (const window of reading.windows) expect(window.start).toBeGreaterThanOrEqual(today)
    const starts = reading.windows.map((window) => window.start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })

  it('explains each window with action labels', () => {
    expect(reading.windows[0]!.why).toMatch(/^Partner is /)
  })

  it('gives the strip a value for any day, and finds past milestones that fit', () => {
    expect(reading.at(today)).toBeGreaterThanOrEqual(0)
    expect(reading.matches).toEqual([married])
  })
})
