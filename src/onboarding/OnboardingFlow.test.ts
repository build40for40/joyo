import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Draft } from './api'
import OnboardingFlow from './OnboardingFlow.vue'
import type { OnboardingResult } from './schema'

const auth = vi.hoisted(() => ({ user: null as object | null, signIn: vi.fn() }))
vi.mock('./auth', () => ({
  getAuth: async () => ({ getUser: () => auth.user, getAccessToken: async () => 'token', signIn: auth.signIn }),
}))

const birth = { date: '1990-04-12', place: 'Testville, Exampleland', location: null, timeOfDay: 'unknown' as const, sureness: 'not_sure' as const, time: null, timeSource: null, notes: '' }

const result: OnboardingResult = {
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
}

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
  it('opens on a choice between starting new and signing in', async () => {
    setUp({ signedIn: false })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('Starting new')
    expect(wrapper.text()).toContain('I have an account')
    expect(wrapper.text()).not.toContain('When and where were you born?')
  })

  it('goes to the hardcoded birth question when starting new, before sign-in', async () => {
    setUp({ signedIn: false })
    const wrapper = await mountFlow()
    await wrapper.findAll('button').find((button) => button.text() === 'Starting new')!.trigger('click')
    expect(wrapper.text()).toContain('When and where were you born?')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('signs in when the visitor already has an account', async () => {
    setUp({ signedIn: false })
    auth.signIn.mockClear()
    const wrapper = await mountFlow()
    await wrapper.findAll('button').find((button) => button.text() === 'I have an account')!.trigger('click')
    await flushPromises()
    expect(auth.signIn).toHaveBeenCalledOnce()
  })

  it('asks how sure the family is only once a time of day is picked', async () => {
    setUp({ signedIn: false })
    const wrapper = await mountFlow()
    await wrapper.findAll('button').find((button) => button.text() === 'Starting new')!.trigger('click')
    expect(wrapper.text()).not.toContain('How sure are they?')
    await wrapper.findAll('button').find((button) => button.text() === 'Roughly')!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text() === 'Evening')!.trigger('click')
    expect(wrapper.text()).toContain('How sure are they?')
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
    setUp({ signedIn: true, result })
    const wrapper = await mountFlow()
    expect(wrapper.text()).toContain('Between 07:30 and 09:30')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/api\/onboarding\/result$/), expect.anything())
    expect(wrapper.emitted('ready')?.[0]?.[0]).toMatchObject({ estimate: { bestGuess: '08:15' } })
    expect(wrapper.text()).not.toContain('Start again')
  })

  it('drops a new draft and goes into the app when the user already has an estimate', async () => {
    setUp({ signedIn: true, draft: { birth, steps: [] }, result })
    const wrapper = await mountFlow()
    expect(wrapper.emitted('ready')).toHaveLength(1)
    expect(localStorage.getItem('joyo:onboarding-draft')).toBeNull()
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/api\/onboarding\/next$/), expect.anything())
  })

  it('shows stars, not the streaming text, until the next question is ready', async () => {
    setUp({ signedIn: true, draft: { birth, steps: [] } })
    const question = { text: 'Is there a birth certificate?', hint: null, input: 'choice', options: ['Yes', 'No'] }
    const turn = new TextEncoder().encode(JSON.stringify({ note: null, question, estimate: null }))
    let finish = () => {}
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/result')) return new Response('Not found', { status: 404 })
      // Scoring is optional: without it the questions carry on.
      if (String(url).endsWith('/progress')) return new Response('Unavailable', { status: 503 })
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(turn.slice(0, 30))
          finish = () => {
            controller.enqueue(turn.slice(30))
            controller.close()
          }
        },
      })
      return new Response(body)
    })
    const wrapper = await mountFlow()
    // The scoring call comes first, so let the question request start before releasing its stream.
    await flushPromises()
    expect(wrapper.find('.loading-stars').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Is there a')

    finish()
    await flushPromises()
    expect(wrapper.find('.loading-stars').exists()).toBe(false)
    expect(wrapper.find('h2').text()).toBe('Is there a birth certificate?')
  })
})
