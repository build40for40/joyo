import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Draft } from './api'
import OnboardingFlow from './OnboardingFlow.vue'
import type { OnboardingResult } from './schema'

const auth = vi.hoisted(() => ({ user: null as object | null }))
vi.mock('./auth', () => ({
  getAuth: async () => ({ getUser: () => auth.user, getAccessToken: async () => 'token', signIn: vi.fn() }),
}))

const birth = { date: '1990-04-12', place: 'Testville, Exampleland', notes: '' }

function setUp({ signedIn, draft, result }: { signedIn: boolean; draft?: Draft; result?: OnboardingResult }) {
  auth.user = signedIn ? { id: 'user_test' } : null
  const items = new Map(draft ? [['joyo:onboarding-draft', JSON.stringify(draft)]] : [])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (result ? Response.json(result) : new Response('Not found', { status: 404 }))),
  )
}

async function mountFlow() {
  const wrapper = mount(OnboardingFlow)
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OnboardingFlow', () => {
  it('opens with the hardcoded birth question, before sign-in', async () => {
    setUp({ signedIn: false })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('When and where were you born?')
  })

  it('asks a signed-out visitor to sign in once the birth details are in', async () => {
    setUp({ signedIn: false, draft: { birth, steps: [] } })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('Sign in')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resumes on the question waiting for an answer', async () => {
    const question = { text: 'Is there a birth certificate?', hint: null, input: 'choice' as const, options: ['Yes', 'No'] }
    setUp({ signedIn: true, draft: { birth, steps: [{ question }] } })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('Is there a birth certificate?')
    expect(wrapper.findAll('.options button').map((button) => button.text())).toEqual(['Yes', 'No'])
  })

  it("shows a signed-in user's saved estimate", async () => {
    setUp({
      signedIn: true,
      result: {
        birth,
        steps: [],
        completedAt: '2026-11-02T09:00:00.000Z',
        estimate: {
          earliest: '07:30',
          latest: '09:30',
          bestGuess: '08:15',
          window: 'morning',
          confidence: 'low',
          summary: 'A first guess from family memory.',
          basis: ['Born before breakfast'],
          events: [],
        },
      },
    })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('Between 07:30 and 09:30')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/api\/onboarding\/result$/), expect.anything())
    expect(wrapper.emitted('ready')?.[0]?.[0]).toMatchObject({ estimate: { bestGuess: '08:15' } })
  })
})
