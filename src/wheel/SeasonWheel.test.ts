import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OnboardingResult } from '@/onboarding/schema'
import SeasonWheel from './SeasonWheel.vue'

const result: OnboardingResult = {
  birth: { date: '1990-04-12', place: 'Testville, Exampleland', notes: '' },
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
    events: [{ type: 'married', date: '2015-06', precision: 'month', notes: '' }],
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
    expect(wrapper.find('.person').text()).toContain('Born 12 Apr 1990 · Testville · 07:30–09:30 (estimated)')
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
    await wrapper.find('textarea').setValue('Started a company in February 2024')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('.milestones').text()).toContain('Started a company · added')
    expect(wrapper.find('.date').text()).toContain('Feb 2024')
    expect(JSON.parse(items.get(`joyo:milestones:${result.completedAt}`)!)).toMatchObject([
      { name: 'Started a company', date: '2024-02', house: 10 },
    ])
  })

  it('asks for a date when a milestone has none', async () => {
    const wrapper = mountWheel()
    await wrapper.find('textarea').setValue('Started a company')
    await wrapper.find('form').trigger('submit')
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

    expect(wrapper.find('.person').text()).toContain('Born 11 Apr 1990 · Testville · 05:50 (birth certificate)')
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
})
