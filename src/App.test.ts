import { describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import App from './App.vue'

vi.mock('@/onboarding/auth', () => ({ getAuth: async () => ({ getUser: () => null }) }))

describe('App', () => {
  it('renders the title', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Joyo')
  })
})
