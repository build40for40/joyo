import { getAuth } from './auth'
import type { AnsweredStep, Birth, History, OnboardingResult, Question } from './schema'

export const ONBOARDING_API = `${import.meta.env.BASE_URL}api/onboarding`

const DRAFT_KEY = 'joyo:onboarding-draft'

export interface Draft {
  birth: Birth
  /** The last step has no answer while it waits on the user. A null answer is a skip. */
  steps: { question: Question; answer?: string | null }[]
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
