import { describe, expect, it } from 'vitest'

import { MAX_QUESTIONS, type History, type Question } from '../src/onboarding/schema'
import { isLastTurn, toModelMessages } from './messages'

const question: Question = { text: 'Was it light outside?', hint: null, input: 'text', options: [] }
const history: History = {
  birth: { date: '1990-04-12', place: 'Testville, Exampleland', location: null, timeOfDay: 'evening', sureness: 'fairly_sure', time: null, timeSource: null, notes: '' },
  steps: [
    { question, answer: 'Yes, just about' },
    { question, answer: null },
  ],
}

describe('toModelMessages', () => {
  it('replays the birth details, then each question and answer in turn', () => {
    const messages = toModelMessages(history)

    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
    expect(messages[0]?.content).toContain('Place of birth: Testville, Exampleland')
    expect(messages[0]?.content).toContain("Exact time of birth: I don't know it")
    expect(messages[0]?.content).not.toContain('Where that time comes from')
    expect(messages[0]?.content).toContain("Time of day I've been told: Evening")
    expect(messages[0]?.content).toContain('How sure that is: Fairly sure')
    expect(messages[0]?.content).toContain('What I know about the time: Nothing.')
    expect(JSON.parse(messages[1]?.content as string)).toEqual({ question, estimate: null })
    expect(messages[4]?.content).toContain('skip')
  })

  it('passes on an exact time and where it came from', () => {
    const exact = { ...history, birth: { ...history.birth, time: '18:05', timeSource: 'certificate' as const } }
    const [first] = toModelMessages(exact)
    expect(first?.content).toContain('Exact time of birth: 18:05')
    expect(first?.content).toContain('Where that time comes from: My birth certificate')
  })
})

describe('isLastTurn', () => {
  it('is true once the question limit is reached', () => {
    expect(isLastTurn(history)).toBe(false)
    expect(isLastTurn({ ...history, steps: Array(MAX_QUESTIONS).fill({ question, answer: null }) })).toBe(true)
  })
})
