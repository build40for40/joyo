"""Stages 1-3 of the rectification prompt, scored exactly as the prompt describes."""
from datetime import timedelta

from vedic import (DRISHTI, LORDS, RASHIS, compute_chart, dasha_at, dasha_timeline,
                   ghati_pala, gochara_at, lagna_spans, sunrise_sunset, varga_spans)

# Event type -> bhavas, karakas, varga (from the prompt's Stage 0 mapping)
EVENT_TYPES = {
    "vivaha":     dict(bhavas=[7], karakas=["Shukra"], varga=9, area="relationships"),
    "santana":    dict(bhavas=[5], karakas=["Guru"], varga=7, area="children"),
    "pita_death": dict(bhavas=[9, 10, 3], karakas=["Surya"], varga=12, area="your father"),
    "mata_death": dict(bhavas=[4, 5, 10], karakas=["Chandra"], varga=12, area="your mother"),
    "karma":      dict(bhavas=[10], karakas=["Shani", "Surya", "Budha"], varga=10, area="work"),
    "vidya":      dict(bhavas=[9, 5], karakas=["Budha", "Guru"], varga=None, area="study"),
    "griha":      dict(bhavas=[4], karakas=["Mangala", "Chandra"], varga=None, area="home"),
    "videsha":    dict(bhavas=[12, 9], karakas=["Rahu"], varga=None, area="living abroad"),
    "roga":       dict(bhavas=[6, 8, 1], karakas=["Mangala", "Shani"], varga=None, area="health"),
}
CONF_WEIGHT = {"high": 1.0, "medium": 0.6, "low": 0.3}

# Prompt as written: karakas count as a connection, the search runs sunrise to
# sunrise, and "nothing I remember" answers are ignored. Variants flip these.
OPTIONS = dict(karaka_counts=True, civil_day=False, use_negatives=False)
NEGATIVE_WEIGHT = 1.0


def connected(graha, bhavas, chart, d, karakas=()):
    """Lord, occupant, graha drishti or karaka of any of the bhavas in varga d."""
    if graha in karakas:
        return True
    lagna, signs = chart["lagna"][d], chart["signs"][d]
    gsign = signs[graha]
    for h in bhavas:
        hs = (lagna + h - 1) % 12
        if LORDS[hs] == graha or gsign == hs:
            return True
        if ((hs - gsign) % 12) + 1 in DRISHTI.get(graha, [7]):
            return True
    return False


def transit_hits(sign, graha, target):
    return sign == target or ((target - sign) % 12) + 1 in DRISHTI[graha]


def score_on_date(chart, timeline, etype, date, place):
    spec = EVENT_TYPES[etype]
    md, ad, pd = dasha_at(timeline, date)
    k = spec["karakas"] if OPTIONS["karaka_counts"] else ()
    c_md = connected(md, spec["bhavas"], chart, 1, k)
    c_ad = connected(ad, spec["bhavas"], chart, 1, k)
    s = 1.5 * c_md + 1.5 * c_ad
    if spec["varga"] and (connected(md, spec["bhavas"], chart, spec["varga"])
                          or connected(ad, spec["bhavas"], chart, spec["varga"])):
        s += 1
    if connected(pd, spec["bhavas"], chart, 1, k):
        s += 1
    if not (c_md or c_ad):
        s -= 2
    g = gochara_at(date, place)

    def hits(base):
        return [any(transit_hits(g[p], p, (base + h - 1) % 12) for h in spec["bhavas"])
                for p in ("Shani", "Guru")]

    from_lagna = hits(chart["lagna"][1])
    if all(from_lagna):
        s += 2
    elif any(from_lagna) or any(hits(chart["signs"][1]["Chandra"])):
        s += 1
    return s


def sample_dates(ev):
    """Monthly samples across an event's date range (a single date if exact)."""
    s, e = ev["date_start"], ev["date_end"]
    if s == e:
        return [s]
    out, t = [], s
    while t <= e:
        out.append(t)
        t += timedelta(days=30)
    return out


def score_event(chart, timeline, ev, place):
    dates = sample_dates(ev)
    raw = sum(score_on_date(chart, timeline, ev["type"], d, place) for d in dates) / len(dates)
    return raw * CONF_WEIGHT[ev["confidence"]]


def score_time(t, events, place):
    chart = compute_chart(t, place)
    tl = dasha_timeline(chart)
    per = {ev["id"]: score_event(chart, tl, ev, place) for ev in events}
    return sum(per.values()), per, chart


def window_of(t, sun):
    if t < sun["sunrise"]:
        return "night"
    if t < sun["noon"]:
        return "morning"
    if t < sun["sunset"]:
        return "afternoon"
    return "night"


def macro(events, place, birth_date):
    """Stage 1: every lagna between sunrise and next sunrise is a candidate."""
    sun = sunrise_sunset(birth_date, place)
    if OPTIONS["civil_day"]:
        midnight = sun["sunrise"].replace(hour=0, minute=0, second=0, microsecond=0)
        lo, hi = midnight, midnight + timedelta(days=1)
    else:
        lo, hi = sun["sunrise"], sun["next_sunrise"]
    cands = []
    for sp in lagna_spans(lo, hi, place):
        mid = sp["start"] + (sp["end"] - sp["start"]) / 2
        total, per, chart = score_time(mid, events, place)
        cands.append(dict(lagna=sp["rashi"], start=sp["start"], end=sp["end"], mid=mid,
                          window=window_of(mid, sun), score=total, per=per, chart=chart))
    cands.sort(key=lambda c: -c["score"])
    return sun, cands


def negative_penalty(chart, negatives):
    """A "nothing happened" answer counts against a time whose dasha predicted that area."""
    tl = dasha_timeline(chart, levels=2)
    pen = 0
    for s, e, etype in negatives:
        _, ad = dasha_at(tl, s + (e - s) / 2)
        if connected(ad, EVENT_TYPES[etype]["bhavas"], chart, 1):
            pen += NEGATIVE_WEIGHT
    return pen


def rescore(cands, events, place, negatives=()):
    for c in cands:
        c["score"], c["per"], c["chart"] = score_time(c["mid"], events, place)
        if OPTIONS["use_negatives"]:
            c["score"] -= negative_penalty(c["chart"], negatives)
    cands.sort(key=lambda c: -c["score"])


def evidence_range(cand, events, place, tolerance=1.0):
    """Every minute in the lagna that scores within `tolerance` of the best minute."""
    scores, t = [], cand["start"]
    while t < cand["end"]:
        scores.append((score_time(t, events, place)[0], t))
        t += timedelta(minutes=1)
    top = max(s for s, _ in scores)
    near = [t for s, t in scores if s >= top - tolerance]
    return min(near), max(near)


def discriminating_periods(a, b, birth, today, asked, n=3):
    """Antardasha periods where the two candidates' lords point at different areas.

    Skips periods already asked about, and periods under 6 months (too short to
    remember) or over 3 years (too vague to answer)."""
    found = []
    for cand, other in ((a, b), (b, a)):
        tl = dasha_timeline(cand["chart"], levels=2)
        for s, e, (md, ad) in tl:
            e = min(e, today)
            if s < birth + timedelta(days=365 * 16) or not 180 <= (e - s).days <= 1100:
                continue
            for etype, spec in EVENT_TYPES.items():
                mine = connected(ad, spec["bhavas"], cand["chart"], 1)
                theirs = connected(ad, spec["bhavas"], other["chart"], 1)
                if mine and not theirs and (s.year, s.month) not in asked:
                    found.append((s, e, etype))
    out, areas = [], set()
    for s, e, etype in sorted(found, key=lambda f: f[0], reverse=True):
        if etype not in areas and (s.year, s.month) not in asked:
            out.append((s, e, etype))
            areas.add(etype)
            asked.add((s.year, s.month))
        if len(out) == n:
            break
    return out


def narrow(cand, events, place):
    """Stage 3: D9 -> D10/D7 -> D12 slices inside the winning lagna, then minute scan."""
    lo, hi = cand["start"], cand["end"]
    trail = []
    for d in (9, 10, 7, 12):
        slices = varga_spans(lo, hi, place, d)
        scored = []
        for sl in slices:
            mid = sl["start"] + (sl["end"] - sl["start"]) / 2
            scored.append((score_time(mid, events, place)[0], sl))
        scored.sort(key=lambda x: -x[0])
        best_score, best = scored[0]
        close = len(scored) > 1 and scored[1][0] >= best_score - 0.5
        trail.append(dict(varga=f"D{d}", slices=len(slices), chosen=best["rashi"],
                          start=best["start"], end=best["end"], score=best_score, close_call=close))
        lo, hi = best["start"], best["end"]
    # Minute scan inside the final slice: the dasha balance shifts minute to minute
    minute_scores = []
    t = lo
    while t <= hi:
        minute_scores.append((score_time(t, events, place)[0], t))
        t += timedelta(minutes=1)
    top = max(s for s, _ in minute_scores)
    best_t = max(minute_scores)[1]
    near = [t for s, t in minute_scores if s >= top - 0.25]
    return trail, best_t, (min(near), max(near))


def describe(c, sun):
    ch = c["chart"]
    lagna_lord = LORDS[ch["lagna"][1]]
    return (f"{c['lagna']} lagna {c['start']:%H:%M}-{c['end']:%H:%M} "
            f"({ghati_pala(c['start'], sun['sunrise'])}), lagna lord {lagna_lord} in "
            f"{RASHIS[ch['signs'][1][lagna_lord]]}, Moon in {RASHIS[ch['signs'][1]['Chandra']]}")
