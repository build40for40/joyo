import { getAuth } from './auth'
import type { DayScore } from '../../worker/sky/score'
import type { AnsweredStep, Birth, History, LifeEvent, Location, OnboardingResult, Question, TurnRequest } from './schema'

export const ONBOARDING_API = `${import.meta.env.BASE_URL}api/onboarding`

const DRAFT_KEY = 'joyo:onboarding-draft'

export interface Draft {
  birth: Birth
  /** The last step has no answer while it waits on the user. A null answer is a skip. */
  steps: { question: Question; answer?: string | null }[]
  /** Dated events the Worker has read from the answers so far. */
  events?: LifeEvent[]
  /** Where the estimate stood after the latest answer. */
  progress?: Progress
}

export interface Progress {
  score: DayScore
  /** What the latest answer did to the leading time, from the scoring. */
  moved: string
  /** The model's one-line explanation of the latest answer. */
  note?: string | null
}

export class PlaceNotFound extends Error {}

/** Reads new dated events from the latest answer and re-scores the whole day. */
export async function fetchProgress(draft: Draft): Promise<{ location: Location; events: LifeEvent[]; progress: Progress }> {
  const response = await authedFetch(`${ONBOARDING_API}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRequest(draft)),
  })
  if (response.status === 422) throw new PlaceNotFound(await response.text())
  if (!response.ok) throw new Error(`Scoring your answers failed with ${response.status}.`)
  const { location, events, score, moved } = await response.json()
  return { location, events, progress: { score, moved } }
}

export const authedFetch: typeof fetch = async (input, init) => {
  const token = await (await getAuth()).getAccessToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export async function fetchResult(): Promise<OnboardingResult | null> {
  const response = await authedFetch(`${ONBOARDING_API}/result`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading your estimate failed with ${response.status}.`)
  return response.json()
}

/** Sends one document to be read for dated events. Only the events come back. */
export async function extractEvents(file: File): Promise<LifeEvent[]> {
  const body = new FormData()
  body.append('file', file)
  const response = await authedFetch(`${ONBOARDING_API}/extract`, { method: 'POST', body })
  if (!response.ok) throw new Error((await response.text()) || "We couldn't read that document.")
  return (await response.json()).events
}

const WHOSE: Record<LifeEvent['about'], string> = {
  self: '',
  father: ' (my father)',
  mother: ' (my mother)',
  sibling: ' (a sibling)',
  grandparent: ' (a grandparent)',
  other: ' (someone else)',
}

/** Extracted events become answer text the user can read and edit before sending. */
export function describeEvents(events: LifeEvent[]) {
  if (!events.length) return ''
  return ['From a document:', ...events.map((event) => `- ${event.date}: ${event.type}${WHOSE[event.about]}`)].join('\n')
}

export function loadDraft(): Draft | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {}
}

export function toHistory({ birth, steps }: Draft): History {
  return { birth, steps: steps.filter((step): step is AnsweredStep => step.answer !== undefined) }
}

export function toRequest(draft: Draft, finish = false): TurnRequest {
  return { ...toHistory(draft), events: draft.events ?? [], finish }
}
