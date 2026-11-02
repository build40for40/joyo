import { MakeTime } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'

import reference from './reference.json'
import { localDay, localToUtc } from './time'
import {
  ascendant,
  ayanamsa,
  computeChart,
  dashaAt,
  dashaTimeline,
  GRAHAS,
  gocharaAt,
  grahaLongitudes,
  lagnaSpans,
  sunriseSunset,
  vargaSpans,
  VARGAS,
  type Graha,
  type Place,
} from './vedic'

/*
 * Every answer is checked against Swiss Ephemeris through tools/rectification-test/export_reference.py.
 * Sign checks skip longitudes within a hair of a sign boundary, where both engines are right to differ.
 */

const DAY = 86_400_000
const LONGITUDE = 0.01 // degrees: 36 arcseconds
const ASCENDANT = 0.02 // degrees: about 5 seconds of time
const SPAN_START = 75_000 // the reference scans whole minutes, so its boundary is up to a minute late
const SUN_EVENT = 90_000

const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const nearBoundary = (longitude: number, width: number) => {
  const offset = longitude % width
  return Math.min(offset, width - offset) < LONGITUDE * 2
}

describe.each(reference.cases)('$name', (c) => {
  const place: Place = c.place
  const birth = localToUtc(c.local, place.tz)
  const chart = computeChart(birth, place)

  it('matches the Lahiri ayanamsa to an arcsecond', () => {
    expect(Math.abs(ayanamsa(MakeTime(new Date(birth))) - c.ayanamsa)).toBeLessThan(1 / 3600)
  })

  it('matches every graha longitude', () => {
    for (const graha of GRAHAS) expect(angle(chart.longitudes[graha], c.lons[graha]), graha).toBeLessThan(LONGITUDE)
  })

  it('matches the ascendant', () => {
    expect(angle(chart.asc, c.asc)).toBeLessThan(ASCENDANT)
  })

  it('puts the lagna and every graha in the same sign in each varga', () => {
    for (const d of VARGAS) {
      if (!nearBoundary(chart.asc, 30 / d)) expect(chart.lagna[d], `lagna D${d}`).toBe(c.lagna[`D${d}` as keyof typeof c.lagna])
      const expected = c.signs[`D${d}` as keyof typeof c.signs] as Record<Graha, number>
      for (const graha of GRAHAS) {
        if (!nearBoundary(chart.longitudes[graha], 30 / d)) expect(chart.signs[d][graha], `${graha} D${d}`).toBe(expected[graha])
      }
    }
  })

  it('runs the same Vimshottari dashas', () => {
    const majors = dashaTimeline(chart, 1)
    c.mahadashas.forEach((expected, index) => {
      expect(majors[index]!.lords[0]).toBe(expected.lord)
      expect(Math.abs(majors[index]!.start - localToUtc(expected.start, place.tz))).toBeLessThan(3 * DAY)
    })
    const timeline = dashaTimeline(chart)
    for (const [date, lords] of Object.entries(c.dashas)) {
      const at = localToUtc(`${date}T00:00`, place.tz)
      const period = dashaAt(timeline, at)
      if (at - period.start > 3 * DAY && period.end - at > 3 * DAY) expect(period.lords, date).toEqual(lords)
    }
  })

  it('finds the same rising signs through the day, to the minute', () => {
    const { start, end } = localDay(c.local.slice(0, 10), place.tz)
    const spans = lagnaSpans(start, end, place)
    expect(spans.map((s) => s.sign)).toEqual(c.lagnaSpans.map((s) => s.sign))
    spans.slice(1).forEach((span, index) => {
      expect(Math.abs(span.start - localToUtc(c.lagnaSpans[index + 1]!.start, place.tz))).toBeLessThan(SPAN_START)
    })
  })

  it('finds the same navamsa changes around the birth', () => {
    const spans = vargaSpans(birth - 3_600_000, birth + 3_600_000, place, 9)
    expect(spans.map((s) => s.sign)).toEqual(c.d9Spans.map((s) => s.sign))
    spans.slice(1).forEach((span, index) => {
      expect(Math.abs(span.start - localToUtc(c.d9Spans[index + 1]!.start, place.tz))).toBeLessThan(SPAN_START)
    })
  })

  it('finds Hindu sunrise, noon, sunset and the next sunrise', () => {
    const sun = sunriseSunset(c.local.slice(0, 10), place)
    expect(Math.abs(sun.sunrise - localToUtc(c.sun.sunrise, place.tz))).toBeLessThan(SUN_EVENT)
    expect(Math.abs(sun.noon - localToUtc(c.sun.noon, place.tz))).toBeLessThan(SUN_EVENT)
    expect(Math.abs(sun.sunset - localToUtc(c.sun.sunset, place.tz))).toBeLessThan(SUN_EVENT)
    expect(Math.abs(sun.nextSunrise - localToUtc(c.sun.next_sunrise, place.tz))).toBeLessThan(SUN_EVENT)
  })

  it('puts the slow grahas in the same signs on transit dates', () => {
    for (const [date, expected] of Object.entries(c.gochara)) {
      const at = localToUtc(`${date}T00:00`, place.tz)
      const longitudes = grahaLongitudes(at)
      const signs = gocharaAt(at)
      for (const graha of ['Shani', 'Guru', 'Rahu', 'Ketu'] as const) {
        if (!nearBoundary(longitudes[graha], 30)) expect(signs[graha], `${graha} ${date}`).toBe(expected[graha])
      }
    }
  })
})

describe('ascendant', () => {
  it('moves through all twelve signs in a day', () => {
    const place = { lat: 51.5, lon: 0, tz: 'Europe/London' }
    const start = localToUtc('2000-06-21T00:00', place.tz)
    const signs = new Set(Array.from({ length: 96 }, (_, i) => Math.floor(ascendant(start + i * 900_000, place) / 30)))
    expect(signs.size).toBe(12)
  })
})
