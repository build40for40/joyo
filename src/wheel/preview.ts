import type { OnboardingResult } from '@/onboarding/schema'

/** An invented person, for opening the wheel at /joyo/#wheel-preview in dev without signing in. */
export const previewResult: OnboardingResult = {
  birth: { date: '1988-03-14', place: 'Testville, Exampleland', timeOfDay: 'morning', sureness: 'not_sure', notes: '' },
  steps: [],
  completedAt: 'preview',
  estimate: {
    earliest: '06:25',
    latest: '06:55',
    bestGuess: '06:40',
    window: 'morning',
    confidence: 'medium',
    summary: 'An example estimate.',
    basis: [],
    events: [
      { type: 'graduated', date: '2009-06', about: 'self', precision: 'month', confidence: 'high', notes: '' },
      { type: 'moved home', date: '2012-09', about: 'self', precision: 'month', confidence: 'high', notes: '' },
      { type: 'first lead role at work', date: '2016-03', about: 'self', precision: 'month', confidence: 'high', notes: '' },
      { type: 'married', date: '2019-08', about: 'self', precision: 'month', confidence: 'high', notes: '' },
      { type: 'first child', date: '2021-11', about: 'self', precision: 'month', confidence: 'high', notes: '' },
      { type: 'started a company', date: '2024-02', about: 'self', precision: 'month', confidence: 'high', notes: '' },
    ],
  },
}
