import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import QuestionStep from './QuestionStep.vue'
import type { Question } from './schema'

vi.mock('./auth', () => ({ getAuth: async () => ({ getAccessToken: async () => 'token' }) }))

const question: Question = { text: 'When did you start and leave each job?', hint: null, input: 'text', options: [] }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('QuestionStep', () => {
  it('hides the mic when the browser has no speech recognition', () => {
    const wrapper = mount(QuestionStep, { props: { question, number: 1 } })
    expect(wrapper.find('.mic').exists()).toBe(false)
  })

  it('shows the mic when the browser has speech recognition', () => {
    vi.stubGlobal('webkitSpeechRecognition', class {})
    const wrapper = mount(QuestionStep, { props: { question, number: 1 } })
    expect(wrapper.find('.mic').exists()).toBe(true)
  })

  it('adds the events read from an uploaded document to the answer', async () => {
    const events = [
      { type: 'started job at a bank', about: 'self', date: '2008-07', precision: 'month', confidence: 'high', notes: '' },
      { type: 'father had an operation', about: 'father', date: '2011', precision: 'year', confidence: 'high', notes: '' },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ events })))
    const wrapper = mount(QuestionStep, { props: { question, number: 1 } })
    await wrapper.find('textarea').setValue('I worked in London.')

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'cv.pdf', { type: 'application/pdf' })],
    })
    await input.trigger('change')
    await flushPromises()

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(
      'I worked in London.\nFrom a document:\n- 2008-07: started job at a bank\n- 2011: father had an operation (my father)',
    )
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/api\/onboarding\/extract$/), expect.objectContaining({ method: 'POST' }))
  })

  it('says so when a document has no dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ events: [] })))
    const wrapper = mount(QuestionStep, { props: { question, number: 1 } })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'cv.pdf', { type: 'application/pdf' })] })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.text()).toContain("We couldn't find any dates in that document.")
  })
})
