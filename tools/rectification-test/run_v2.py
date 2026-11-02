"""The updated prompt: whole calendar day, direct life-area questions, evidence levels."""
import sys
from datetime import timedelta

import personas
from personas import PERSONAS, TODAY
from rectify import (EVENT_TYPES, OPTIONS, discriminating_periods, evidence_range, macro,
                     narrow, rescore)

OPTIONS.update(karaka_counts=True, civil_day=True, use_negatives=False)
MARGIN, M_MIN, VARGA_TOL = 0.08, 6, 2.0


def counts(events):
    usable = [e for e in events if e["confidence"] != "low"]
    exact = sum(e["precision"] == "exact" for e in usable)
    month = sum(e["precision"] in ("exact", "month") for e in usable)
    years = [e["true_date"].year for e in usable]
    return exact, month, len(usable), (max(years) - min(years) if years else 0)


def level_for(events):
    exact, month, total, spread = counts(events)
    if month < M_MIN:
        return "insufficient"
    if exact >= 6 and exact * 2 >= total and spread >= 20:
        return "minute"
    if exact >= 4:
        return "varga"
    return "lagna"


def ask_missing_areas(known, hidden):
    """Direct questions by life area: the user tells every untold event in a missing area."""
    have = {e["type"] for e in known}
    told = [h for h in hidden if h["type"] not in have]
    for h in told:
        h["hidden"] = False
    return told


def run(p, seed=40):
    place, events = personas.build(p, seed=seed)
    truth = p["true"]
    known = [e for e in events if not e["hidden"]]
    hidden = [e for e in events if e["hidden"]]

    # Stage 0: ask about missing life areas by name
    told = ask_missing_areas(known, hidden)
    known += told
    hidden = [h for h in hidden if h["hidden"]]

    sun, cands = macro(known, place, truth.date())
    asked, leader_clear = set(), False
    for _ in range(3):
        a, b = cands[0], cands[1]
        if (a["score"] - b["score"]) / max(abs(a["score"]), 1) >= MARGIN:
            leader_clear = True
            break
        told = ask_missing_areas(known, hidden)
        for s, e, _ in discriminating_periods(a, b, truth, TODAY, asked):
            ans = next((h for h in hidden if h["hidden"] and s <= h["true_date"] <= e), None)
            if ans:
                ans["hidden"] = False
                told.append(ans)
        known += told
        hidden = [h for h in hidden if h["hidden"]]
        rescore(cands, known, place)
    else:
        a, b = cands[0], cands[1]
        leader_clear = (a["score"] - b["score"]) / max(abs(a["score"]), 1) >= MARGIN

    level = level_for(known)
    if not leader_clear:
        level = "insufficient"
    lead = cands[0]
    if level == "insufficient":
        in_play = [c for c in cands if c["score"] >= lead["score"] * 0.85]
        ok = any(c["start"] <= truth < c["end"] for c in in_play)
        width = sum((c["end"] - c["start"]).total_seconds() / 60 for c in in_play)
        answer = f"{len(in_play)} lagnas in play"
    elif level == "lagna":
        lo, hi = lead["start"], lead["end"]
        ok, width, answer = lo <= truth < hi, (hi - lo).total_seconds() / 60, f"{lo:%H:%M}–{hi:%H:%M}"
    else:
        trail, best_t, _ = narrow(lead, known, place)
        if level == "varga":
            lo, hi = evidence_range(lead, known, place, tolerance=VARGA_TOL)
        else:
            lo, hi = evidence_range(lead, known, place)
        ok = lo <= truth <= hi + timedelta(minutes=1)
        width, answer = (hi - lo).total_seconds() / 60 + 1, f"{lo:%H:%M}–{hi:%H:%M}"
    return dict(level=level, ok=ok, width=width, answer=answer, events=counts(known))


if __name__ == "__main__":
    seeds = range(int(sys.argv[1]) if len(sys.argv) > 1 else 10)
    print("| persona | levels reached | right (truth inside what was reported) | typical width |")
    print("|---|---|---|---|")
    for p in PERSONAS:
        rows = [run(p, s) for s in seeds]
        levels = {}
        for r in rows:
            levels[r["level"]] = levels.get(r["level"], 0) + 1
        widths = sorted(r["width"] for r in rows)
        print(f"| {p['name']} | {', '.join(f'{k} {v}' for k, v in sorted(levels.items()))} | "
              f"{sum(r['ok'] for r in rows)}/{len(rows)} | {widths[len(widths) // 2]:.0f} min |")
