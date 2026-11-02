import type { Estimate, History, OnboardingResult } from '../src/onboarding/schema'
import type { DayScore } from './sky/score'

export const resultKey = (userId: string) => `result:${userId}`

export function saveResult(kv: KVNamespace, userId: string, history: History, estimate: Estimate, now: Date, scoring?: DayScore) {
  const result: OnboardingResult = { ...history, estimate, completedAt: now.toISOString(), ...(scoring && { scoring }) }
  return kv.put(resultKey(userId), JSON.stringify(result))
}
