import { describe, expect, it, vi } from 'vitest'

import type { Estimate, History } from '../src/onboarding/schema'
import { saveResult } from './results'

const history: History = { birth: { date: '1990-04-12', place: 'Testville, Exampleland', location: null, timeOfDay: 'evening', sureness: 'fairly_sure', notes: '' }, steps: [] }
const estimate: Estimate = {
  earliest: '07:30',
  latest: '09:30',
  bestGuess: '08:15',
  window: 'morning',
  confidence: 'low',
  summary: 'A first guess.',
  basis: [],
  events: [],
}

describe('saveResult', () => {
  it("writes the history and estimate under the user's result key", async () => {
    const put = vi.fn(async (_key: string, _value: string) => {})
    const kv = { put } as unknown as KVNamespace

    await saveResult(kv, 'user_test', history, estimate, new Date('2026-11-02T09:00:00Z'))

    expect(put).toHaveBeenCalledWith('result:user_test', expect.any(String))
    expect(JSON.parse(put.mock.calls[0]?.[1] ?? '')).toEqual({
      ...history,
      estimate,
      completedAt: '2026-11-02T09:00:00.000Z',
    })
  })
})
