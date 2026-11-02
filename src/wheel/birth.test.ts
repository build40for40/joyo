import { describe, expect, it } from 'vitest'

import { outsideWindow } from './birth'

describe('outsideWindow', () => {
  it('compares a recorded time with the estimated window', () => {
    const window = { earliest: '06:25', latest: '06:55' }
    expect(outsideWindow('06:40', window)).toBe(false)
    expect(outsideWindow('05:50', window)).toBe(true)
    expect(outsideWindow('07:10', window)).toBe(true)
  })

  it('handles a window that runs past midnight', () => {
    const window = { earliest: '23:00', latest: '01:00' }
    expect(outsideWindow('23:30', window)).toBe(false)
    expect(outsideWindow('00:30', window)).toBe(false)
    expect(outsideWindow('02:00', window)).toBe(true)
  })
})
