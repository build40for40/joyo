import { describe, expect, it } from 'vitest'

import { workosApiHostname, workosClientId } from './workos'

describe('workosClientId', () => {
  it('uses production on the live site and staging everywhere else', () => {
    expect(workosClientId('build40for40.com')).toBe('client_01M6E5ZDQ9XBYYE28XYN7H3XTJ')
    expect(workosClientId('localhost')).toBe('client_01M6E5ZDCH31RFHPJTD8N5JQZY')
    expect(workosClientId('st-118-joyo-onboarding-joyo.40for40.workers.dev')).toBe('client_01M6E5ZDCH31RFHPJTD8N5JQZY')
  })
})

describe('workosApiHostname', () => {
  it('uses the custom auth domain for production and api.workos.com for staging', () => {
    expect(workosApiHostname(workosClientId('build40for40.com'))).toBe('auth.build40for40.com')
    expect(workosApiHostname(workosClientId('localhost'))).toBe('api.workos.com')
  })
})
