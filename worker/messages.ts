import type { ModelMessage } from 'ai'

import { MAX_QUESTIONS, type History } from '../src/onboarding/schema'

export const LAST_TURN_INSTRUCTION =
  'You have asked as many questions as onboarding allows. Give the estimate now, with question set to null.'

export function isLastTurn(history: History) {
  return history.steps.length >= MAX_QUESTIONS
}

export function toModelMessages({ birth, steps }: History): ModelMessage[] {
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        `Date of birth: ${birth.date}`,
        `Place of birth: ${birth.place}`,
        `What I know about the time: ${birth.notes || 'Nothing.'}`,
      ].join('\n'),
    },
  ]

  for (const { question, answer } of steps) {
    messages.push({ role: 'assistant', content: JSON.stringify({ question, estimate: null }) })
    messages.push({ role: 'user', content: answer ?? "I don't know, skip this one." })
  }

  return messages
}
