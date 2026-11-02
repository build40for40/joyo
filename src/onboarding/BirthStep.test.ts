import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BirthStep from './BirthStep.vue'

async function fillIn(choice: string) {
  const wrapper = mount(BirthStep)
  await wrapper.find('input[type="date"]').setValue('1990-04-12')
  await wrapper.find('input[type="text"]').setValue('Testville, Exampleland')
  await wrapper.findAll('button').find((button) => button.text() === choice)!.trigger('click')
  return wrapper
}

describe('BirthStep', () => {
  it('sends an exact time with where it came from', async () => {
    const wrapper = await fillIn('Yes, the exact time')
    await wrapper.find('input[type="time"]').setValue('18:05')
    await wrapper.findAll('button').find((button) => button.text() === 'Hospital record')!.trigger('click')
    expect(wrapper.text()).not.toContain('How sure are they?')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      time: '18:05',
      timeSource: 'hospital',
      timeOfDay: 'evening',
      sureness: 'sure',
    })
  })

  it('asks how sure they are when the exact time is only remembered', async () => {
    const wrapper = await fillIn('Yes, the exact time')
    await wrapper.findAll('button').find((button) => button.text() === 'Someone remembers it')!.trigger('click')
    expect(wrapper.text()).toContain('How sure are they?')
  })

  it('sends no time at all when they have no idea', async () => {
    const wrapper = await fillIn('No idea')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      time: null,
      timeSource: null,
      timeOfDay: 'unknown',
      sureness: 'not_sure',
    })
  })
})
