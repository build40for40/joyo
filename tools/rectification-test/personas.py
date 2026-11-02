"""Made-up test personas with a known (hidden) birth time.

Each persona's life events are planted in the dasha periods that the TRUE chart
says fit them best, then blurred to the precision a real person would remember.
That gives the engine a correct answer to find. It tests whether the prompt's
method recovers a time, not whether Jyotish itself predicts lives.
"""
import random
from datetime import datetime, timedelta

from rectify import score_on_date
from vedic import compute_chart, dasha_timeline, geocode

TODAY = datetime(2026, 11, 2)

# spec: (id, type, min_age, max_age, precision, confidence, hidden, source)
#   hidden=True: the user only mentions it if asked about that period
#   type ending in "!" is a misremembered event: planted where it fits WORST
PERSONAS = [
    dict(name="Aisha", place="London", true=datetime(1990, 4, 17, 8, 14),
         about="Rich data: 10 exactly dated events across her life, mostly from documents.",
         story="Typed story plus uploads (marriage certificate, two birth certificates, flight booking).",
         events=[("e1", "vidya", 18, 22, "exact", "high", False, "text"),
                 ("e2", "karma", 21, 24, "exact", "high", False, "text"),
                 ("e3", "vivaha", 25, 31, "exact", "high", False, "document"),
                 ("e4", "santana", 27, 33, "exact", "high", False, "document"),
                 ("e5", "santana", 30, 35, "exact", "high", False, "document"),
                 ("e6", "videsha", 22, 30, "exact", "high", False, "document"),
                 ("e7", "pita_death", 20, 36, "exact", "high", False, "text"),
                 ("e8", "griha", 28, 35, "month", "high", False, "text"),
                 ("e9", "karma", 30, 36, "month", "medium", False, "text"),
                 ("e10", "roga", 14, 20, "year", "medium", False, "text")]),
    dict(name="Dev", place="Mumbai", true=datetime(1985, 11, 3, 15, 47),
         about="Thin data: only 4 vague events at first; more only when asked.",
         story="Short voice note, no documents.",
         events=[("e1", "karma", 22, 26, "year", "medium", False, "voice"),
                 ("e2", "vivaha", 26, 34, "month", "high", False, "voice"),
                 ("e3", "griha", 30, 40, "year", "medium", False, "voice"),
                 ("e4", "mata_death", 25, 40, "month", "high", False, "voice"),
                 ("e5", "santana", 28, 38, "exact", "high", True, "voice"),
                 ("e6", "karma", 32, 40, "month", "medium", True, "voice"),
                 ("e7", "roga", 18, 30, "year", "medium", True, "voice"),
                 ("e8", "videsha", 26, 38, "month", "medium", True, "voice")]),
    dict(name="Maya", place="Toronto", true=datetime(1979, 7, 22, 23, 31),
         about="Night birth; every event she gives is from one decade (2005-2014), month or season only.",
         story="Typed story only.",
         events=[("e1", "karma", 26, 28, "month", "high", False, "text"),
                 ("e2", "vivaha", 27, 31, "season", "high", False, "text"),
                 ("e3", "griha", 29, 33, "month", "medium", False, "text"),
                 ("e4", "santana", 31, 35, "month", "high", False, "text"),
                 ("e5", "karma", 32, 35, "season", "medium", False, "text"),
                 ("e6", "pita_death", 40, 46, "exact", "high", True, "text"),
                 ("e7", "vidya", 18, 22, "year", "high", True, "text"),
                 ("e8", "videsha", 36, 44, "month", "medium", True, "text")]),
    dict(name="Bilal", place="Lahore", true=datetime(1993, 1, 9, 5, 52),
         about="Born before sunrise (so in the previous Vedic day); one misremembered event; mixed sources.",
         story="Voice note plus a photo of a flight ticket and a nikah nama.",
         events=[("e1", "vidya", 18, 22, "year", "high", False, "voice"),
                 ("e2", "karma", 22, 25, "month", "high", False, "voice"),
                 ("e3", "videsha", 23, 28, "exact", "high", False, "document"),
                 ("e4", "vivaha", 26, 31, "exact", "high", False, "document"),
                 ("e5", "griha!", 24, 32, "year", "medium", False, "voice"),
                 ("e6", "pita_death", 20, 33, "month", "high", False, "voice"),
                 ("e7", "santana", 28, 33, "exact", "high", True, "voice"),
                 ("e8", "karma", 27, 33, "month", "medium", True, "voice")]),
]


def blur(date, precision):
    if precision == "exact":
        return date, date
    if precision == "month":
        s = date.replace(day=1)
        return s, (s + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    if precision == "season":
        s = date.replace(day=1) - timedelta(days=31)
        return s.replace(day=1), (date + timedelta(days=45)).replace(day=1)
    return datetime(date.year, 1, 1), datetime(date.year, 12, 31)


def build(persona, seed=40):
    rng = random.Random(seed + len(persona["name"]))
    place = geocode(persona["place"])
    chart = compute_chart(persona["true"], place)
    tl = dasha_timeline(chart)
    born = persona["true"]
    events = []
    for eid, etype, a0, a1, prec, conf, hidden, source in persona["events"]:
        wrong = etype.endswith("!")
        etype = etype.rstrip("!")
        lo = born + timedelta(days=365.25 * a0)
        hi = min(born + timedelta(days=365.25 * a1), TODAY - timedelta(days=60))
        options = []
        for s, e, _ in tl:
            mid = s + (e - s) / 2
            if lo <= mid <= hi:
                options.append((score_on_date(chart, tl, etype, mid, place), rng.random(), mid))
        options.sort(reverse=not wrong)
        date = options[0][2].replace(hour=0, minute=0, second=0, microsecond=0)
        ds, de = blur(date, prec)
        events.append(dict(id=eid, type=etype, date_start=ds, date_end=de, true_date=date,
                           precision=prec, confidence=conf, hidden=hidden, source=source,
                           misremembered=wrong))
    return place, events
