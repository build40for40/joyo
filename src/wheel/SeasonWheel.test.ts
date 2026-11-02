import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OnboardingResult } from '@/onboarding/schema'
import SeasonWheel from './SeasonWheel.vue'

const result: OnboardingResult = {
  birth: { date: '1990-04-12', place: 'Testville, Exampleland', location: null, timeOfDay: 'morning', sureness: 'not_sure', time: null, timeSource: null, notes: '' },
  steps: [],
  completedAt: '2026-11-02T09:00:00.000Z',
  estimate: {
    earliest: '07:30',
    latest: '09:30',
    bestGuess: '08:15',
    window: 'morning',
    confidence: 'medium',
    summary: 'A first guess.',
    basis: [],
    events: [{ kind: 'marriage', type: 'married', date: '2015-06', about: 'self', precision: 'month', confidence: 'high', notes: '' }],
  },
}

let items: Map<string, string>

beforeEach(() => {
  items = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mountWheel = () => mount(SeasonWheel, { props: { result, now: new Date('2026-11-02T00:00:00Z') } })

describe('SeasonWheel', () => {
  it('shows the birth details, the estimate and the milestones from onboarding', () => {
    const wrapper = mountWheel()
    expect(wrapper.find('.person').text()).toContain('Born 12 Apr 1990 · Testville')
    expect(wrapper.find('.person').text()).toContain('07:30–09:30 (estimated)')
    expect(wrapper.find('.birth').text()).toContain('12 Apr 199007:30–09:30')
    expect(wrapper.find('.birth').text()).toContain('Estimated from your milestones · medium confidence')
    expect(wrapper.find('.birth').text()).toContain('not a certainty')
    expect(wrapper.find('.milestones').text()).toContain('Married')
    expect(wrapper.find('.milestones').text()).toContain('Jun 2015 → Partner')
  })

  it('always shows the legend and describes every house in words', () => {
    const wrapper = mountWheel()
    expect(wrapper.find('.legend-labels').text()).toBe('RestingSteadyActive')
    expect(wrapper.findAll('.sr-only li')).toHaveLength(12)
  })

  it('adds a dated milestone, saves it and jumps to it', async () => {
    const wrapper = mountWheel()
    await wrapper.find('#milestone').setValue('Started a company in February 2024')
    await wrapper.find('#story-panel form').trigger('submit')
    expect(wrapper.find('.milestones').text()).toContain('Started a company · added')
    expect(wrapper.find('.date').text()).toContain('Feb 2024')
    expect(JSON.parse(items.get(`joyo:milestones:${result.completedAt}`)!)).toMatchObject([
      { name: 'Started a company', date: '2024-02', house: 10 },
    ])
  })

  it('asks for a date when a milestone has none', async () => {
    const wrapper = mountWheel()
    await wrapper.find('#milestone').setValue('Started a company')
    await wrapper.find('#story-panel form').trigger('submit')
    expect(wrapper.text()).toContain('Add a month and year')
    expect(items.size).toBe(0)
  })

  it('removes a milestone added on the wheel', async () => {
    items.set(
      `joyo:milestones:${result.completedAt}`,
      JSON.stringify([{ id: 'a', name: 'Moved abroad', date: '2020-05', house: 12 }]),
    )
    const wrapper = mountWheel()
    await wrapper.find('[aria-label="Remove Moved abroad"]').trigger('click')
    expect(wrapper.find('.milestones').text()).not.toContain('Moved abroad')
    expect(items.size).toBe(0)
  })

  it('uses a birth time found written down instead of the estimate', async () => {
    const wrapper = mountWheel()
    await wrapper.find('.birth .link').trigger('click')
    await wrapper.find('.birth input[type="date"]').setValue('1990-04-11')
    await wrapper.find('.birth input[type="time"]').setValue('05:50')
    await wrapper.findAll('.birth .chip')[0]!.trigger('click')
    await wrapper.find('.birth form').trigger('submit')

    expect(wrapper.find('.person').text()).toContain('Born 11 Apr 1990 · Testville')
    expect(wrapper.find('.person').text()).toContain('05:50 (birth certificate)')
    expect(wrapper.find('.birth').text()).toContain('From your birth certificate')
    expect(wrapper.find('.birth').text()).toContain('Your milestones pointed to 07:30–09:30')
    expect(wrapper.find('.birth').text()).not.toContain('not a certainty')
    expect(JSON.parse(items.get(`joyo:birth-record:${result.completedAt}`)!)).toEqual({
      date: '1990-04-11',
      time: '05:50',
      source: 'certificate',
    })
  })

  it('asks where the time is written before using it', async () => {
    const wrapper = mountWheel()
    await wrapper.find('.birth .link').trigger('click')
    await wrapper.find('.birth input[type="time"]').setValue('05:50')
    await wrapper.find('.birth form').trigger('submit')
    expect(wrapper.find('.birth [role="alert"]').text()).toContain('Pick where the time is written down.')
    expect(items.size).toBe(0)
  })

  it('opens on asking, with Ask as the gold action and Add outlined', () => {
    const wrapper = mountWheel()
    expect(wrapper.find('#ask-tab').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('#ask-panel .primary').text()).toBe('Ask')
    expect(wrapper.find('#story-panel .secondary').text()).toBe('Add')
  })

  it('answers a picked question with starred windows on the timeline', async () => {
    const wrapper = mountWheel()
    await wrapper.findAll('.chip').find((chip) => chip.text() === 'Marriage')!.trigger('click')
    expect(wrapper.find('.answer h3').text()).toBe('When is a good time to marry?')
    expect(wrapper.findAll('.answer .windows li').length).toBeGreaterThan(0)
    expect(wrapper.find('.answer').text()).toContain('strongest')
    expect(wrapper.find('.answer').text()).toContain('In your story: Married · Jun 2015')
    expect(wrapper.find('.answer').text()).toContain('treat the edges of each window loosely')
  })

  it('matches a typed question and frames "should" kindly', async () => {
    const wrapper = mountWheel()
    await wrapper.find('#question').setValue('Should I move to another country?')
    await wrapper.find('#ask-panel form').trigger('submit')
    expect(wrapper.find('.answer h3').text()).toBe('Should I move to another country?')
    expect(wrapper.find('.answer').text()).toContain('If you do, these seasons support it.')
    expect(wrapper.find('.chip[aria-pressed="true"]').text()).toContain('Move countries')
  })

  it('reminds people to follow their doctor on health questions', async () => {
    const wrapper = mountWheel()
    await wrapper.findAll('.chip').find((chip) => chip.text() === 'Health')!.trigger('click')
    expect(wrapper.find('.answer').text()).toContain("Go with your doctor's timing first.")
  })

  it('jumps back to today from anywhere on the timeline', async () => {
    const wrapper = mountWheel()
    await wrapper.findAll('.chip').find((chip) => chip.text() === 'Marriage')!.trigger('click')
    expect(wrapper.find('.date').text()).not.toContain('2 Nov 2026')
    await wrapper.find('.today-link').trigger('click')
    expect(wrapper.find('.date').text()).toBe('2 Nov 2026')
    expect(wrapper.find('.today-link').attributes('aria-pressed')).toBe('true')
  })

  it('opens the birth form from the link at the top', async () => {
    const wrapper = mountWheel()
    expect(wrapper.find('.birth form').exists()).toBe(false)
    await wrapper.find('.update-birth').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.birth form').exists()).toBe(true)
    expect((wrapper.find('.birth input[type="date"]').element as HTMLInputElement).value).toBe('1990-04-12')
  })
})
