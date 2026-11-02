import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import StarField from './StarField.vue'

describe('StarField', () => {
  it('renders 200 stars by default', () => {
    const wrapper = mount(StarField)
    expect(wrapper.findAll('.star')).toHaveLength(200)
  })

  it('is hidden from assistive tech', () => {
    const wrapper = mount(StarField, { props: { count: 3 } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
