import { describe, expect, it } from 'vitest'

import { historySchema, MAX_ANSWER_LENGTH, MAX_QUESTIONS, type Question } from './schema'

const birth = { date: '1990-04-12', place: 'Testville, Exampleland', notes: 'Before lunch' }
const question: Question = { text: 'Is there a birth certificate?', hint: null, input: 'choice', options: ['Yes', 'No'] }

describe('historySchema', () => {
  it('accepts birth details with answered and skipped steps', () => {
    const history = { birth, steps: [{ question, answer: 'Yes' }, { question, answer: null }] }
    expect(historySchema.safeParse(history).success).toBe(true)
  })

  it('treats missing time-of-day fields as no idea, not sure', () => {
    const parsed = historySchema.parse({ birth, steps: [] })
    expect(parsed.birth).toMatchObject({ timeOfDay: 'unknown', sureness: 'not_sure' })
  })

  it('rejects a time of day outside the chips', () => {
    expect(historySchema.safeParse({ birth: { ...birth, timeOfDay: 'teatime' }, steps: [] }).success).toBe(false)
  })

  it('rejects bad dates, unanswered steps, oversized answers and too many steps', () => {
    const rejected = [
      { birth: { ...birth, date: '12/04/1990' }, steps: [] },
      { birth, steps: [{ question }] },
      { birth, steps: [{ question, answer: 'x'.repeat(MAX_ANSWER_LENGTH + 1) }] },
      { birth, steps: Array(MAX_QUESTIONS + 1).fill({ question, answer: null }) },
    ]
    for (const history of rejected) expect(historySchema.safeParse(history).success).toBe(false)
  })
})
