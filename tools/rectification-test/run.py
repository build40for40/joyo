"""Dry run: each persona goes through Stages 0-3 of the prompt; results/<name>.md per persona."""
from datetime import timedelta
from pathlib import Path

from personas import PERSONAS, TODAY, build
from rectify import (EVENT_TYPES, OPTIONS, describe, discriminating_periods, evidence_range,
                     macro, narrow, rescore)

OUT = Path(__file__).parent / "results"


def fmt_ev(ev):
    span = (f"{ev['date_start']:%Y-%m-%d}" if ev["precision"] == "exact"
            else f"{ev['date_start']:%Y-%m}..{ev['date_end']:%Y-%m}")
    flag = " (misremembered)" if ev["misremembered"] else ""
    return f"| {ev['id']} | {ev['type']} | {span} | {ev['precision']} | {ev['confidence']} | {ev['source']}{flag} |"


def run(p, out):
    place, all_events = build(p)
    truth = p["true"]
    log = [f"# {p['name']} — {p['place']}", "", p["about"], "", f"Input: {p['story']}", "",
           f"**Hidden true birth time:** {truth:%Y-%m-%d %H:%M}", ""]
    known = [e for e in all_events if not e["hidden"]]
    hidden = [e for e in all_events if e["hidden"]]

    # Stage 0: enough events, spread across the life?
    years = sorted(e["true_date"].year for e in known)
    log += ["## Stage 0 — Intake", "", "| id | type | date | precision | confidence | source |",
            "|---|---|---|---|---|---|"] + [fmt_ev(e) for e in known] + [""]
    asked_more = len(known) < 6 or years[-1] - years[0] < 10
    if asked_more:
        extra = hidden[: max(1, len(hidden) // 2)]
        for e in extra:
            e["hidden"] = False
        known += extra
        hidden = [e for e in hidden if e["hidden"]]
        log += [f"Fewer than 6 events or all within one decade ({years[0]}–{years[-1]}): "
                f"asked for more. User added: {', '.join(e['id'] + ' ' + e['type'] for e in extra)}.", ""]

    # Stage 1
    sun, cands = macro(known, place, truth.date())
    true_c = next((c for c in cands if c["start"] <= truth < c["end"]), None)
    in_day = true_c is not None
    lo_d, hi_d = min(c["start"] for c in cands), max(c["end"] for c in cands)
    log += ["## Stage 1 — Three macro readings", "",
            f"Searched: {lo_d:%Y-%m-%d %H:%M} → {hi_d:%Y-%m-%d %H:%M} (sunrise {sun['sunrise']:%H:%M})."
            + ("" if in_day else " **The true birth time is outside this window.**"), ""]
    for w in ("morning", "afternoon", "night"):
        best = next((c for c in cands if c["window"] == w), None)
        if best:
            fit = [k for k, v in best["per"].items() if v >= 2]
            bad = [k for k, v in best["per"].items() if v <= 0]
            log.append(f"- **{w.title()}** (rank {cands.index(best) + 1}, score {best['score']:.1f}): "
                       f"{describe(best, sun)}. Fits: {', '.join(fit) or '—'}. Poor fit: {', '.join(bad) or '—'}.")
    rank_true = cands.index(true_c) + 1 if true_c else None
    log += ["", f"True lagna rank after Stage 1: {rank_true or 'not in the searched day'} of {len(cands)}.", ""]

    # Stage 2
    log += ["## Stage 2 — Discriminating questions", ""]
    asked, negatives = set(), []
    for rnd in range(1, 4):
        a, b = cands[0], cands[1]
        margin = (a["score"] - b["score"]) / max(abs(a["score"]), 1)
        if margin >= 0.15:
            log.append(f"Round {rnd}: {a['lagna']} leads {b['lagna']} by {margin:.0%} — clear leader, stop.")
            break
        log.append(f"Round {rnd}: {a['lagna']} ({a['score']:.1f}) vs {b['lagna']} ({b['score']:.1f}), "
                   f"margin {margin:.0%}.")
        for s, e, etype in discriminating_periods(a, b, truth, TODAY, asked):
            q = f"What changed in {EVENT_TYPES[etype]['area']} between {s:%b %Y} and {e:%b %Y}?"
            ans = next((h for h in hidden if s <= h["true_date"] <= e), None)
            if ans:
                ans["hidden"] = False
                hidden.remove(ans)
                known.append(ans)
                log.append(f"  - Q: {q} → user: {ans['type']} ({ans['id']})")
            else:
                negatives.append((s, e, etype))
                log.append(f"  - Q: {q} → user: nothing I remember")
        rescore(cands, known, place, negatives)
    else:
        log.append("Stopped after 3 rounds without a clear leader.")
    rank_true = next((i + 1 for i, c in enumerate(cands) if c["start"] <= truth < c["end"]), None)
    log += ["", f"Leader: {cands[0]['lagna']} {cands[0]['start']:%H:%M}-{cands[0]['end']:%H:%M}. "
            f"True lagna rank now: {rank_true or 'not in the searched day'}.", ""]

    # Stage 3
    trail, best_t, (lo, hi) = narrow(cands[0], known, place)
    log += ["## Stage 3 — Narrowing", "", "| varga | slices | chosen | window | close call |", "|---|---|---|---|---|"]
    for t in trail:
        log.append(f"| {t['varga']} | {t['slices']} | {t['chosen']} | {t['start']:%H:%M}–{t['end']:%H:%M} | "
                   f"{'yes' if t['close_call'] else ''} |")
    hit = lo <= truth <= hi + timedelta(minutes=1)
    elo, ehi = evidence_range(cands[0], known, place)
    ehit = elo <= truth <= ehi + timedelta(minutes=1)
    err = (best_t - truth).total_seconds() / 60
    log += ["", "## Result", "",
            f"- Best estimate **{best_t:%H:%M}**, range {lo:%H:%M}–{hi:%H:%M}",
            f"- Truth {truth:%H:%M} → error {err:+.0f} min, {'inside' if hit else 'OUTSIDE'} the range",
            f"- Range the evidence supports (within 1 point of the best minute): {elo:%H:%M}–{ehi:%H:%M} "
            f"({(ehi - elo).total_seconds() / 60 + 1:.0f} min), truth {'inside' if ehit else 'OUTSIDE'}",
            f"- Events used: {len(known)} (hidden left unasked: {len(hidden)})", ""]
    (out / f"{p['name'].lower()}.md").write_text("\n".join(log))
    return dict(name=p["name"], truth=truth, best=best_t, lo=lo, hi=hi, err=err, hit=hit,
                elo=elo, ehi=ehi, ehit=ehit,
                stage1_rank=rank_true, lagna_ok=cands[0]["start"] <= truth < cands[0]["end"],
                in_day=in_day, asked_more=asked_more)


VARIANTS = [
    ("1-as-written", {}),
    ("2-civil-day", dict(civil_day=True)),
    ("3-plus-no-karaka", dict(civil_day=True, karaka_counts=False)),
    ("4-plus-negatives", dict(civil_day=True, karaka_counts=False, use_negatives=True)),
]

if __name__ == "__main__":
    for vname, opts in VARIANTS:
        OPTIONS.update(dict(karaka_counts=True, civil_day=False, use_negatives=False), **opts)
        out = OUT / vname
        out.mkdir(parents=True, exist_ok=True)
        rows = [run(p, out) for p in PERSONAS]
        print(f"\n### {vname}\n")
        print("| persona | truth | estimate | range | error | in range | right lagna | evidence range | truth in it |")
        print("|---|---|---|---|---|---|---|---|---|")
        for r in rows:
            width = (r["ehi"] - r["elo"]).total_seconds() / 60 + 1
            print(f"| {r['name']} | {r['truth']:%H:%M} | {r['best']:%H:%M} | {r['lo']:%H:%M}–{r['hi']:%H:%M} | "
                  f"{r['err']:+.0f} min | {'yes' if r['hit'] else 'no'} | {'yes' if r['lagna_ok'] else 'no'} | "
                  f"{r['elo']:%H:%M}–{r['ehi']:%H:%M} ({width:.0f} min) | {'yes' if r['ehit'] else 'no'} |")
