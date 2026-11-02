# Ticket: make onboarding a conversation of input and output

Status: to do. Raised 2 November 2026 after the first full live run of the onboarding.

## What went wrong in the live run

1. **Nothing came back until the end.** The user answered question after question and saw no sign that any answer mattered. There was no "that makes a morning birth more likely", no running estimate and no sense of progress.
2. **The reasoning was hidden.** The estimate arrived at the end with a short summary, but the user never saw why each answer moved it.
3. **It ended at low confidence with no way forward.** The run finished on a wide, low-confidence window. It didn't say what would raise confidence or offer to keep going.
4. **There was no way to skip ahead.** A user who wants to see the experience first (the wheel and the birth-time view) had to answer every question.

## What we want

Every answer gets a visible response, the user can always see where the estimate stands and why, and the experience is never more than one tap away.

### 1. A live estimate after every answer

- Show a small **running estimate** above each question: the current window (for example "Most likely 06:00–11:00, morning"), a confidence level in words with a gold bar, and progress towards enough evidence ("4 of 6 dated events").
- Under it, a one-line **what changed** note for the last answer, in plain words. For example:
  - "A family memory you're fairly sure of: I'm leaning towards the morning."
  - "Starting university in October 2004 is an exact date. That's the kind of event the full reading needs."
  - "You skipped this one. Nothing changes, and that's fine."
- When an answer doesn't change the window, say so honestly rather than inventing movement.
- Keep a short **"Why this estimate"** list the user can expand, built from each answer's note.

### 2. Honest about what onboarding can know

Onboarding has no astronomy tools, so in this phase it must not claim that a life event points to a particular time of day. That needs the sidereal calculations.

- **Phase 1 (this ticket):** the running estimate moves only on direct evidence: records, family memory and circumstances like light or dark. The notes for dated life events talk about evidence ("that's a strong date for the reading"), not about the birth time.
- **Phase 2 (follow-up):** once the Worker has the rectification tools from `src/rectification/system-prompt.md`, each dated event re-scores the day, and the note can say "that fits a morning birth better". This feeds the likelihood curve on card 119.

### 3. Skip to the experience, at any point

- Add a secondary **"Skip to my chart"** button on every onboarding screen, including the splash.
- Skipping saves the answers so far and opens the experience with the current estimate, or the whole day if there's nothing yet. Show it clearly as low confidence.
- From the experience, the user can come back with **"Add more about my life"** and carry on from the same draft.

### 4. A better low-confidence ending

- When the estimate is still low confidence, say plainly why ("Most of your dates are year-only") and list the two or three answers that would help most, such as an exact move date or a parent's illness to the month.
- Offer **"Keep going"** (more questions, past the current 12-question limit) next to **"See my chart now"**.

## Changes this implies

- **Turn schema** (`src/onboarding/schema.ts`): every question turn also returns a `progress` object: `{ earliest, latest, bestGuess, window, confidence, changed, datedEvents, datedEventsNeeded }`. `changed` is the one-line note about the last answer.
- **Onboarding prompt** (`worker/onboarding-prompt.md`):
  - Return `progress` with every question.
  - Write `changed` as one short, warm line about the last answer, never claiming astronomy.
  - Move the window only on direct evidence in Phase 1.
- **UI:**
  - A running-estimate strip and a "what changed" line in `QuestionStep.vue`, styled to `docs/brand.md`: mono times, a gold confidence bar, no fear words.
  - A "Skip to my chart" secondary button.
  - An expandable "Why this estimate" list.
  - A low-confidence ending with "Keep going" and "See my chart now".
- **Saving:** skipping writes a partial result to KV, marked `partial: true`, so "I have an account" brings the user back to it.
- **Limits:** raise or remove `MAX_QUESTIONS` when the user chooses "Keep going".

## Done when

- After every answer, the user sees the current window, confidence, evidence progress and a one-line note about what their answer did.
- No note claims that a life event makes a particular time more likely until Phase 2's calculations exist.
- "Skip to my chart" is on every onboarding screen and works with zero answers.
- A low-confidence ending names what would help and offers both "Keep going" and "See my chart now".
- `npm run fake` shows all of the above with canned progress updates, and the tests cover the new schema fields and the skip path.
