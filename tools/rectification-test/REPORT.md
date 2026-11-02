# Rectification prompt: persona dry run

Date: 2026-11-02. Superthread card 114.

## What we ran

Four made-up personas, each with a hidden "true" birth time, went through Stages 0–3 of `src/rectification/system-prompt.md`. Real sidereal (Lahiri) calculations came from Swiss Ephemeris. Each persona ran 10 times, with event dates planted differently each time.

| Persona | Place | True time | What it tests |
|---|---|---|---|
| Aisha | London | 08:14 | Rich data: 10 events across her life, mostly exact dates from documents |
| Dev | Mumbai | 15:47 | Thin data: 4 vague events at first, more only when asked |
| Maya | Toronto | 23:31 | Night birth, events all from one decade, only month or season precision |
| Bilal | Lahore | 05:52 | Born before sunrise, one misremembered event, mixed sources |

## Results with the prompt as written (10 runs each)

| Persona | Right lagna (rising sign) | Truth inside the final range | Typical error |
|---|---|---|---|
| Aisha | 10/10 | 10/10 | 3 min |
| Dev | 4/10 | 4/10 | 6.6 hours |
| Maya | 10/10 | 0/10 | 11 min |
| Bilal | 0/10 | 0/10 | 15 hours |

## Findings

1. **It works when the data is good.** With about 10 events, mostly exact dates from documents, it finds the time to within a few minutes every time.
2. **Bug: births before sunrise are never searched.** The prompt searches from sunrise to the next sunrise, starting at sunrise on the birth date. So a 05:52 birth on a day when the sun rose at 07:04 is never a candidate. Bilal failed 10/10 for this reason alone.
3. **It claims too much precision when the dates are vague.** Maya's rising sign was right every time, but the minute-level answer was wrong every time. Dates known only to the month or season can't support a 2–9 minute range. The prompt says "never claim more precision than the evidence supports", but it never defines what that means.
4. **Thin data fails, and the questions don't rescue it.** Dev got the rising sign right only 4/10 times. The follow-up questions are built around dasha periods ("what changed in your work between Oct 2023 and Oct 2024?"), and in Dev's runs they brought out only 1 of his 4 untold events. When there isn't enough evidence, the prompt should say so instead of naming a time.
5. **Two ideas tested and rejected.**
   - Not counting karakas (the natural significators, such as Shukra for marriage) as a connection made results worse: Aisha's lagna dropped to 8/10 and Dev's to 0/10. So the prompt should keep counting karakas.
   - Counting "nothing I remember" answers as evidence against a time didn't help either.

## Recommended prompt changes

1. **Search the whole calendar day.** Search 00:00–24:00 on the birth date, and file anything before sunrise under the night window. Fixing the search window alone only took Bilal from 0/10 to 1/10, so the misremembered event is also hurting him.
2. **Tie how far it narrows, and the confidence level, to how precise the dates are.** For example:
   - Narrow past the rising sign and the D9 chart only when at least 4 events have exact dates.
   - Give a minute-level range only when most events have exact dates.
   - Otherwise, stop at a wider range and say why.

   This feeds into card 115 (onboarding output and confidence levels).
3. **Add a "not enough evidence" result.** If fewer than about 6 events have a month or better, ask for documents first. If the user can't provide them, return the remaining candidates instead of one time.
4. **Ask about life areas directly, as well as dasha periods.** For example: "When were your children born?" or "Have you lived abroad?" This brings out untold events better than asking about date ranges.

## After the prompt update (`run_v2.py`, 10 runs each)

Changes made to `src/rectification/system-prompt.md`:
- search the whole calendar day
- ask about life areas by name
- evidence levels (insufficient / lagna / varga / minute)
- end with "insufficient evidence" if no lagna clearly leads after three rounds
- narrow by scoring the whole lagna against all events, instead of D9 first and then only inside that slice

| Persona | What it reported | Right (truth inside what it reported) | Typical width |
|---|---|---|---|
| Aisha | minute ×3, varga ×7 | 10/10 | 9–10 min |
| Dev | insufficient ×10 | 10/10 | ~9 hours of candidates |
| Maya | insufficient ×10 | 10/10 | ~3.5 hours of candidates |
| Bilal | insufficient ×10 | 7/10 | ~10 hours of candidates |

It no longer gives a confidently wrong time. The cost is that thin or vague data now gets "insufficient evidence" plus a list of candidate lagnas, instead of an answer. Bilal's candidate list still missed the true lagna 3 times in 10.

The thresholds came from tuning on these same four personas, so they are a starting point, not settled values:
- a leader margin of 8%
- at least 6 events with a month-or-better date
- a varga range of 2 points from the best score

A further finding: narrowing D9-first got Aisha's slice right only 4 times in 7, while scoring every minute of the lagna got it right 7 times in 7.

## Limits of this test

- **Best case.** Events were planted in the periods the true chart favours, using the same scoring rules the engine uses. So these results are a best case. They test whether the method can recover a time, not whether Jyotish predicts real lives.
- **Code standing in for the AI.** The model's role was played by deterministic code following the prompt's rules. A real model could reason differently. Intake, meaning pulling events out of text, voice and documents, wasn't tested: events went in already structured.
- **Simplified tools.** Not implemented: Ashtakavarga bindus, D60, KP sub-lords, Jaimini Chara Dasha, Pranapada, Gulika, the Tattva check and physical description.
- **Small sample.** 4 personas × 10 runs.

## Files

- `vedic.py`: the sidereal tools (geocode, sunrise, lagna and varga spans, chart, Vimshottari dasha, transits)
- `rectify.py`: the prompt's scoring and Stages 1–3
- `personas.py`: the four personas and how their events are planted
- `run.py`: one run per persona and prompt variant; transcripts go in `results/<variant>/<name>.md`
- `seeds.py`: the 10-run robustness check
