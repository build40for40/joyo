/**
 * The sidereal (Lahiri) Jyotish tools from src/rectification/system-prompt.md, on astronomy-engine.
 * A port of tools/rectification-test/vedic.py, tested against its Swiss Ephemeris answers in
 * reference.json. Times are UTC milliseconds; the place's time zone only matters for local clock times.
 */
import { Body, e_tilt, Ecliptic, EclipticGeoMoon, GeoVector, MakeTime, Observer, SearchAltitude, SearchHourAngle, SiderealTime, SunPosition, type AstroTime } from 'astronomy-engine'

import { localDay, utcToLocal } from './time'

export const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'] as const

export const GRAHAS = ['Surya', 'Chandra', 'Mangala', 'Budha', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu'] as const
export type Graha = (typeof GRAHAS)[number]

/** Sign lords, Mesha to Meena. */
export const LORDS: readonly Graha[] = ['Mangala', 'Shukra', 'Budha', 'Chandra', 'Surya', 'Budha', 'Shukra', 'Mangala', 'Guru', 'Shani', 'Shani', 'Guru']

/** Parashari graha drishti: houses counted from the graha. Every graha also aspects the 7th. */
export const DRISHTI: Partial<Record<Graha, number[]>> = {
  Mangala: [4, 7, 8],
  Guru: [5, 7, 9],
  Shani: [3, 7, 10],
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
}

export const VARGAS = [1, 7, 9, 10, 12] as const
export type Varga = (typeof VARGAS)[number]

const DASHA_ORDER: readonly Graha[] = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangala', 'Rahu', 'Guru', 'Shani', 'Budha']
const DASHA_YEARS: Record<string, number> = { Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangala: 7, Rahu: 18, Guru: 16, Shani: 19, Budha: 17 }
const NAKSHATRA = 360 / 27
const YEAR_MS = 365.25 * 86_400_000
const MINUTE = 60_000

export interface Place {
  lat: number
  lon: number
  /** IANA time zone, e.g. Europe/London. */
  tz: string
}

const norm = (degrees: number) => ((degrees % 360) + 360) % 360
const rad = (degrees: number) => (degrees * Math.PI) / 180
const deg = (radians: number) => (radians * 180) / Math.PI

/** Julian centuries of TT since J2000. */
const centuries = (time: AstroTime) => time.tt / 36525

/**
 * Lahiri (Chitrapaksha) ayanamsa: its value at J2000 plus IAU 2006 general precession in longitude.
 * Matches Swiss Ephemeris's SIDM_LAHIRI to well under an arcsecond over 1900–2100.
 */
export function ayanamsa(time: AstroTime) {
  const t = centuries(time)
  return 23.857092353 + (5028.796195 * t + 1.1054348 * t * t) / 3600
}

/** Longitude of the Moon's mean ascending node, mean equinox of date (Meeus 47.7). */
function meanNode(time: AstroTime) {
  const t = centuries(time)
  return norm(125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441 - (t * t * t * t) / 60616000)
}

const BODIES: Partial<Record<Graha, Body>> = {
  Mangala: Body.Mars,
  Budha: Body.Mercury,
  Guru: Body.Jupiter,
  Shukra: Body.Venus,
  Shani: Body.Saturn,
}

/** Tropical ecliptic longitude of date, geocentric and apparent. */
function tropicalLongitude(graha: Graha, time: AstroTime) {
  if (graha === 'Surya') return SunPosition(time).elon
  if (graha === 'Chandra') return EclipticGeoMoon(time).lon
  if (graha === 'Rahu') return meanNode(time)
  if (graha === 'Ketu') return norm(meanNode(time) + 180)
  return Ecliptic(GeoVector(BODIES[graha]!, time, true)).elon
}

/**
 * Sidereal longitudes of the nine grahas. As in Swiss Ephemeris, nutation is taken out: the ayanamsa
 * is a mean value, so true positions of date would otherwise carry up to 17″ of nutation into every
 * sign, and the Moon's share alone moves Vimshottari dates by days.
 */
export function grahaLongitudes(utcMs: number): Record<Graha, number> {
  const time = MakeTime(new Date(utcMs))
  const ayan = ayanamsa(time)
  const nutation = e_tilt(time).dpsi / 3600
  return Object.fromEntries(
    GRAHAS.map((graha) => [graha, norm(tropicalLongitude(graha, time) - (graha === 'Rahu' || graha === 'Ketu' ? 0 : nutation) - ayan)]),
  ) as Record<Graha, number>
}

/** Sidereal longitude of the ascendant (lagna), with nutation taken out as for the grahas. */
export function ascendant(utcMs: number, place: Place) {
  const time = MakeTime(new Date(utcMs))
  const tilt = e_tilt(time)
  const ramc = rad(norm(SiderealTime(time) * 15 + place.lon))
  const obliquity = rad(tilt.tobl)
  const tropical = deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(obliquity) + Math.tan(rad(place.lat)) * Math.sin(obliquity))))
  return norm(tropical - tilt.dpsi / 3600 - ayanamsa(time))
}

/** The Parashari varga rashi (0 = Mesha) for a sidereal longitude. */
export function vargaSign(longitude: number, division: Varga) {
  const sign = Math.floor(longitude / 30)
  const part = Math.floor((longitude % 30) / (30 / division))
  const odd = sign % 2 === 0 // Mesha, index 0, is an odd sign
  switch (division) {
    case 1:
      return sign
    case 9:
      return Math.floor(longitude / (30 / 9)) % 12
    case 10:
      return (odd ? sign + part : sign + 8 + part) % 12
    case 7:
      return (odd ? sign + part : sign + 6 + part) % 12
    case 12:
      return (sign + part) % 12
  }
}

export interface Chart {
  utcMs: number
  asc: number
  longitudes: Record<Graha, number>
  /** Lagna rashi in each varga. */
  lagna: Record<Varga, number>
  /** Each graha's rashi in each varga. */
  signs: Record<Varga, Record<Graha, number>>
}

export function computeChart(utcMs: number, place: Place): Chart {
  return chartFrom(utcMs, ascendant(utcMs, place), grahaLongitudes(utcMs))
}

/** A chart from positions already worked out, so a day scan can reuse them. */
export function chartFrom(utcMs: number, asc: number, longitudes: Record<Graha, number>): Chart {
  const lagna = Object.fromEntries(VARGAS.map((d) => [d, vargaSign(asc, d)])) as Record<Varga, number>
  const signs = Object.fromEntries(
    VARGAS.map((d) => [d, Object.fromEntries(GRAHAS.map((g) => [g, vargaSign(longitudes[g], d)]))]),
  ) as Record<Varga, Record<Graha, number>>
  return { utcMs, asc, longitudes, lagna, signs }
}

export interface Span {
  sign: number
  rashi: (typeof RASHIS)[number]
  start: number
  end: number
}

/** Stretches where the varga lagna stays in one sign, with each change found to the second. */
export function vargaSpans(start: number, end: number, place: Place, division: Varga): Span[] {
  const signAt = (t: number) => vargaSign(ascendant(t, place), division)
  const spans: Span[] = []
  let spanStart = start
  let current = signAt(start)
  for (let t = start + MINUTE; t < end + MINUTE; t += MINUTE) {
    const at = Math.min(t, end)
    const sign = signAt(at)
    if (sign === current) continue
    let low = at - MINUTE
    let high = at
    while (high - low > 1000) {
      const mid = (low + high) / 2
      if (signAt(mid) === current) low = mid
      else high = mid
    }
    spans.push({ sign: current, rashi: RASHIS[current]!, start: spanStart, end: high })
    spanStart = high
    current = sign
  }
  spans.push({ sign: current, rashi: RASHIS[current]!, start: spanStart, end })
  return spans
}

export const lagnaSpans = (start: number, end: number, place: Place) => vargaSpans(start, end, place, 1)

export interface DashaPeriod {
  start: number
  end: number
  /** Maha, Antar and Pratyantar lords, as deep as asked for. */
  lords: Graha[]
}

/** The Vimshottari timeline from the Moon's nakshatra, two full 120-year cycles from before birth. */
export function dashaTimeline(chart: Chart, levels: 1 | 2 | 3 = 3): DashaPeriod[] {
  const moon = chart.longitudes.Chandra
  const first = Math.floor(moon / NAKSHATRA) % 9
  const elapsed = (moon % NAKSHATRA) / NAKSHATRA
  const out: DashaPeriod[] = []

  function split(start: number, years: number, lordIndex: number, depth: number, path: Graha[]) {
    if (depth === levels) {
      out.push({ start, end: start + years * YEAR_MS, lords: path })
      return
    }
    let t = start
    for (let k = 0; k < 9; k++) {
      const index = (lordIndex + k) % 9
      const sub = DASHA_ORDER[index]!
      const subYears = (years * DASHA_YEARS[sub]!) / 120
      split(t, subYears, index, depth + 1, [...path, sub])
      t += subYears * YEAR_MS
    }
  }

  let t = chart.utcMs - elapsed * DASHA_YEARS[DASHA_ORDER[first]!]! * YEAR_MS
  for (let k = 0; k < 18; k++) {
    const index = (first + k) % 9
    const lord = DASHA_ORDER[index]!
    split(t, DASHA_YEARS[lord]!, index, 1, [lord])
    t += DASHA_YEARS[lord]! * YEAR_MS
  }
  return out
}

export function dashaAt(timeline: DashaPeriod[], utcMs: number) {
  const period = timeline.find((p) => p.start <= utcMs && utcMs < p.end)
  if (!period) throw new Error('That date is outside the dasha timeline.')
  return period
}

/** Sidereal rashi of the slow grahas on a date. */
export function gocharaAt(utcMs: number) {
  const longitudes = grahaLongitudes(utcMs)
  return Object.fromEntries((['Shani', 'Guru', 'Rahu', 'Ketu'] as const).map((g) => [g, Math.floor(longitudes[g] / 30)])) as Record<
    'Shani' | 'Guru' | 'Rahu' | 'Ketu',
    number
  >
}

/** Altitude of the Sun's centre at Hindu sunrise and sunset: on the horizon after refraction. */
const SUN_CENTRE_ON_HORIZON = -34 / 60

/** Hindu sunrise (the Sun's centre, with refraction), local noon, sunset and the next sunrise. */
export function sunriseSunset(date: string, place: Place) {
  const observer = new Observer(place.lat, place.lon, 0)
  const from = MakeTime(new Date(localDay(date, place.tz).start))
  const find = (direction: 1 | -1, after: AstroTime) => {
    const time = SearchAltitude(Body.Sun, observer, direction, after, 2, SUN_CENTRE_ON_HORIZON)
    if (!time) throw new Error('The Sun does not rise or set there on that date.')
    return time
  }
  const sunrise = find(1, from)
  const noon = SearchHourAngle(Body.Sun, observer, 0, sunrise).time
  const sunset = find(-1, sunrise)
  const nextSunrise = find(1, sunset)
  return { sunrise: sunrise.date.getTime(), noon: noon.date.getTime(), sunset: sunset.date.getTime(), nextSunrise: nextSunrise.date.getTime() }
}

/** Time since sunrise in ghati and pala (1 ghati = 24 minutes, 1 pala = 24 seconds). */
export function ghatiPala(utcMs: number, sunrise: number) {
  const seconds = (utcMs - sunrise) / 1000
  const ghati = Math.floor(seconds / 1440)
  return `${ghati}gh ${Math.floor((seconds - ghati * 1440) / 24)}pa`
}

export { utcToLocal }
