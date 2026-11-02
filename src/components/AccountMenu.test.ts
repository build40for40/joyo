import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AccountMenu from './AccountMenu.vue'

const auth = vi.hoisted(() => ({ user: null as object | null, signOut: vi.fn() }))
vi.mock('@/onboarding/auth', () => ({ getAuth: async () => ({ getUser: () => auth.user, signOut: auth.signOut }) }))

async function mountMenu(props = {}) {
  const wrapper = mount(AccountMenu, { props, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('AccountMenu', () => {
  it('stays hidden when nobody is signed in', async () => {
    auth.user = null
    const wrapper = await mountMenu()
    expect(wrapper.find('.trigger').exists()).toBe(false)
  })

  it('shows who is signed in and signs them out back to Joyo', async () => {
    auth.user = { firstName: 'Asha', lastName: 'Example', email: 'asha@example.com' }
    const wrapper = await mountMenu()
    await wrapper.find('.trigger').trigger('click')
    expect(wrapper.find('.who').text()).toContain('Asha Example')
    expect(wrapper.find('.who').text()).toContain('asha@example.com')
    await wrapper.findAll('[role="menuitem"]').find((item) => item.text() === 'Sign out')!.trigger('click')
    await flushPromises()
    expect(auth.signOut).toHaveBeenCalledWith({ returnTo: expect.stringMatching(/\/$/) })
    wrapper.unmount()
  })

  it('offers to update the birth details on the wheel, and closes on Escape', async () => {
    auth.user = { firstName: null, lastName: null, email: 'asha@example.com' }
    const wrapper = await mountMenu({ canUpdateBirth: true })
    await wrapper.find('.trigger').trigger('click')
    expect(wrapper.find('.trigger').attributes('aria-expanded')).toBe('true')
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click')
    expect(wrapper.emitted('updateBirth')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await wrapper.find('.trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
