/** A milestone typed or spoken on the wheel, after onboarding. Kept in the browser for now. */
export interface AddedMilestone {
  id: string
  name: string
  /** YYYY or YYYY-MM. */
  date: string
  house: number
}

// Keyed by the onboarding result, so a new estimate or another account on this device starts clean.
const key = (completedAt: string) => `joyo:milestones:${completedAt}`

export function loadAddedMilestones(completedAt: string): AddedMilestone[] {
  try {
    const saved = localStorage.getItem(key(completedAt))
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function saveAddedMilestones(completedAt: string, milestones: AddedMilestone[]) {
  try {
    if (milestones.length) localStorage.setItem(key(completedAt), JSON.stringify(milestones))
    else localStorage.removeItem(key(completedAt))
  } catch {}
}
