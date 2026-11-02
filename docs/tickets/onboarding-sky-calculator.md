# Ticket: plug the sky calculator into the onboarding

Status: to do. Raised 2 November 2026. Step 3 of getting the morning's rectification work into the app:

1. ✅ The tested Python harness is in `tools/rectification-test/`.
2. ✅ The sky calculator is ported to TypeScript in `worker/sky/` and checked against Swiss Ephemeris.
3. **This ticket:** use it in the onboarding, so each answer re-scores the day and the user sees why.

It delivers Phase 2 of [`onboarding-feedback-loop.md`](onboarding-feedback-loop.md).

## The idea

Today the model asks questions and guesses a window from family memory alone. After this ticket, **code** scores every minute of the birth day against the user's dated events, using `worker/sky/vedic.ts` and the scoring rules in `src/rectification/system-prompt.md`. The **model** explains those results and picks the next question. The model still never calculates anything itself.

## What to build

### 1. Place → coordinates and time zone
- `geocode(place)` in the Worker returns latitude, longitude and an IANA time zone. Use a geocoding API that returns time zones, such as Open-Meteo's (free, no key), and cache results in KV.
- If a place is ambiguous, ask the user to pick from the matches. Never guess.
- Store `{ lat, lon, tz }` with the birth details.

### 2. Scoring in TypeScript (`worker/sky/score.ts`)
Port the scoring from `tools/rectification-test/rectify.py`, with the master prompt's updated rules:
- **Events to houses.** Map each event to its bhavas, karakas and varga using the prompt's Stage 0 table, using the event's `type` and `about`.
- **Ranking.** Score each lagna every 2 minutes across the whole calendar day, and rank by best minute.
- **Balance.** Average within each event type, then add the types.
- **Other people's events.** Count lordship and occupancy only, not aspects.
- **Family memory.** At most a 10% bonus for the hinted window, removable when the user is unsure.
- **Evidence levels.** Insufficient, lagna, varga or minute, from the counts of exact and month-dated events.
- **Output:**
  - a likelihood for every 5 minutes of the day, for the curve on card 119
  - the ranked candidates with ranges
  - the evidence level
  - for each event, which candidates it supports, with the reason in plain words (for example, "the marriage fell in Shukra's period, and Shukra rules the 7th house for a Tula rising")

### 3. The onboarding loop
- After each answer, the Worker re-scores in code and sends the model a compact summary: the top candidates, how the last answer moved them, and the dasha periods where the top two disagree.
- The model returns the next question plus the `progress` note from the feedback-loop ticket. The note may now say "that fits a morning birth better", because the numbers came from code.
- **The window, confidence and likelihood come from the scoring, not the model.**
- Discriminating questions use the periods where candidates disagree (Stage 2 of the master prompt), phrased openly.

### 4. The result
- The final estimate comes from the scoring:
  - best time and range
  - lagna, plus D9 and D10 where the evidence level allows
  - confidence and evidence level
  - the events that pinned it down
- **Data contract** for the Season Wheel and card 119, to agree with Ben:
  - `likelihood: { time, score }[]` at 5-minute steps
  - `candidates: { lagna, start, end, bestMinute, confidence }[]`
  - `lagna`
  - each event's house from the chart, not keyword matching

### 5. Performance
- A full-day scan is about 720 charts times the number of events. Cache the per-minute ascendant and Moon longitude per birth in KV.
- Measure the CPU time per answer, and check it fits the Workers plan's CPU limit before shipping.

## Tests
- **TypeScript scoring agrees with Python.** Export the four personas and their scores from `rectify.py`, as `export_reference.py` does for the sky. The TypeScript scoring must rank the same lagnas and land within the same ranges.
- **Persona results hold.** Re-running the personas through the TypeScript path gives the same outcomes as `run_v2.py`:
  - rich data finds the time
  - thin or vague data says "insufficient"
  - a birth before sunrise is searched
- **Geocoding:** ambiguous places, historical time zones, and a place that isn't found.
- **Fake mode:** `npm run fake` stays usable, with canned scoring.

## Done when
- Every answer re-scores the day in code, and the screen shows the moved window with a reason grounded in the chart.
- The final estimate, confidence and evidence level come from the scoring, and match the Python reference on the personas.
- The Season Wheel and card 119 get the agreed data: the likelihood curve, candidates, lagna and event houses.
- A full answer turn stays within the Workers CPU limit.
- No real person's data is in fixtures, prompts or logs.
