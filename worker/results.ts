import type { Estimate, History, OnboardingResult } from '../src/onboarding/schema'

export const resultKey = (userId: string) => `result:${userId}`

export function saveResult(kv: KVNamespace, userId: string, history: History, estimate: Estimate, now: Date) {
  const result: OnboardingResult = { ...history, estimate, completedAt: now.toISOString() }
  return kv.put(resultKey(userId), JSON.stringify(result))
}
