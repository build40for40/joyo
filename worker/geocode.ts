import type { Location } from '../src/onboarding/schema'

const SEARCH = 'https://geocoding-api.open-meteo.com/v1/search'
const CACHE_SECONDS = 30 * 24 * 60 * 60

interface OpenMeteoPlace {
  name: string
  latitude: number
  longitude: number
  timezone?: string
  admin1?: string
  country?: string
}

/** Up to 5 places matching a name, with coordinates and an IANA time zone. Cached in KV. */
export async function searchPlaces(query: string, kv: KVNamespace, fetcher: typeof fetch = fetch): Promise<Location[]> {
  const key = `geo:${query.trim().toLowerCase()}`
  const cached = await kv.get<Location[]>(key, 'json')
  if (cached) return cached

  // Open-Meteo matches on the first part of a name, so "Leeds, UK" searches for "Leeds".
  const name = query.split(',')[0]!.trim()
  const url = `${SEARCH}?${new URLSearchParams({ name, count: '10', language: 'en', format: 'json' })}`
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`Place search failed with ${response.status}`)
  const { results = [] } = (await response.json()) as { results?: OpenMeteoPlace[] }

  const hint = query.split(',').slice(1).join(' ').trim().toLowerCase()
  const places = results
    .filter((place) => place.timezone)
    .map((place) => ({
      label: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
      lat: place.latitude,
      lon: place.longitude,
      tz: place.timezone!,
    }))
    // Anything typed after the comma, like a country, moves the matching places to the top.
    .sort((a, b) => Number(!!hint && b.label.toLowerCase().includes(hint)) - Number(!!hint && a.label.toLowerCase().includes(hint)))
    .slice(0, 5)

  await kv.put(key, JSON.stringify(places), { expirationTtl: CACHE_SECONDS })
  return places
}
