"""Writes worker/sky/reference.json: Swiss Ephemeris answers the TypeScript port is tested against.

    .venv/bin/python export_reference.py
"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import swisseph as swe

from vedic import (RASHIS, Place, _spans, compute_chart, dasha_at, dasha_timeline, gochara_at,
                   sunrise_sunset)

OUT = Path(__file__).resolve().parents[2] / "worker" / "sky" / "reference.json"

# Made-up births spread over decades, latitudes, both hemispheres and DST rules.
CASES = [
    ("j2000-london", 51.5074, -0.1278, "Europe/London", "2000-01-01T12:00"),
    ("london-spring", 51.5074, -0.1278, "Europe/London", "1990-04-17T08:14"),
    ("mumbai-afternoon", 19.0760, 72.8777, "Asia/Kolkata", "1985-11-03T15:47"),
    ("toronto-night", 43.6532, -79.3832, "America/Toronto", "1979-07-22T23:31"),
    ("lahore-before-sunrise", 31.5204, 74.3587, "Asia/Karachi", "1993-01-09T05:52"),
    ("sydney-summer", -33.8688, 151.2093, "Australia/Sydney", "2004-12-25T19:05"),
    ("new-york-1965", 40.7128, -74.0060, "America/New_York", "1965-06-30T02:40"),
    ("reykjavik-winter", 64.1466, -21.9426, "Atlantic/Reykjavik", "2012-02-14T10:30"),
]
DASHA_DATES = ["2005-03-01", "2012-09-15", "2020-06-01", "2026-11-01"]
TRANSIT_DATES = ["2001-01-01", "2010-07-15", "2023-03-04"]


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%S")


def case(name, lat, lon, tz, local):
    place = Place(lat, lon, ZoneInfo(tz))
    t = datetime.fromisoformat(local)
    chart = compute_chart(t, place)
    timeline = dasha_timeline(chart)
    majors = dasha_timeline(chart, levels=1)
    day = datetime(t.year, t.month, t.day)
    sun = sunrise_sunset(day.date(), place)
    return {
        "name": name,
        "place": {"lat": lat, "lon": lon, "tz": tz},
        "local": local,
        "ayanamsa": swe.get_ayanamsa_ut(chart["jd"]),
        "asc": chart["asc"],
        "lons": chart["lons"],
        "lagna": {f"D{d}": s for d, s in chart["lagna"].items()},
        "signs": {f"D{d}": signs for d, signs in chart["signs"].items()},
        "dashas": {d: list(dasha_at(timeline, datetime.fromisoformat(d))) for d in DASHA_DATES},
        "mahadashas": [{"lord": path[0], "start": iso(s)} for s, _, path in majors[:6]],
        "lagnaSpans": [{"sign": s["sign"], "start": iso(s["start"])}
                       for s in _spans(day, day + timedelta(days=1), place, 1)],
        "d9Spans": [{"sign": s["sign"], "start": iso(s["start"])}
                    for s in _spans(t - timedelta(hours=1), t + timedelta(hours=1), place, 9)],
        "sun": {k: iso(v) for k, v in sun.items()},
        "gochara": {d: gochara_at(datetime.fromisoformat(d), place) for d in TRANSIT_DATES},
    }


if __name__ == "__main__":
    data = {"ayanamsaSystem": "Lahiri", "rashis": RASHIS, "cases": [case(*c) for c in CASES]}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {OUT} with {len(data['cases'])} cases")
