"""Sidereal (Lahiri) Jyotish tools from the rectification prompt, on Swiss Ephemeris.

Implements the subset the dry run needs: geocode, sunrise_sunset, lagna_spans,
varga_spans, compute_chart, dasha_at / dasha_timeline and gochara_at.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import swisseph as swe

swe.set_sid_mode(swe.SIDM_LAHIRI)
FLAGS = swe.FLG_MOSEPH | swe.FLG_SIDEREAL

RASHIS = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
          "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"]
GRAHAS = {"Surya": swe.SUN, "Chandra": swe.MOON, "Mangala": swe.MARS,
          "Budha": swe.MERCURY, "Guru": swe.JUPITER, "Shukra": swe.VENUS,
          "Shani": swe.SATURN, "Rahu": swe.MEAN_NODE}
# Sign lords, Mesha..Meena
LORDS = ["Mangala", "Shukra", "Budha", "Chandra", "Surya", "Budha",
         "Shukra", "Mangala", "Guru", "Shani", "Shani", "Guru"]
# Parashari graha drishti: houses counted from the graha (7th for all)
DRISHTI = {"Mangala": [4, 7, 8], "Guru": [5, 7, 9], "Shani": [3, 7, 10],
           "Rahu": [5, 7, 9], "Ketu": [5, 7, 9]}
DASHA_ORDER = ["Ketu", "Shukra", "Surya", "Chandra", "Mangala",
               "Rahu", "Guru", "Shani", "Budha"]
DASHA_YEARS = dict(zip(DASHA_ORDER, [7, 20, 6, 10, 7, 18, 16, 19, 17]))
NAKSHATRA = 360 / 27
YEAR_DAYS = 365.25

# Stand-in for a geocoding API: lat, lon, IANA zone (historical offsets come from tzdata)
PLACES = {
    "London": (51.5074, -0.1278, "Europe/London"),
    "Mumbai": (19.0760, 72.8777, "Asia/Kolkata"),
    "Toronto": (43.6532, -79.3832, "America/Toronto"),
    "Lahore": (31.5204, 74.3587, "Asia/Karachi"),
}


@dataclass
class Place:
    lat: float
    lon: float
    tz: ZoneInfo


def geocode(name):
    lat, lon, tz = PLACES[name]
    return Place(lat, lon, ZoneInfo(tz))


def jd_ut(local_dt, place):
    """Julian day (UT) for a naive local clock time, using the offset in force that day."""
    utc = local_dt.replace(tzinfo=place.tz).astimezone(timezone.utc)
    return swe.julday(utc.year, utc.month, utc.day,
                      utc.hour + utc.minute / 60 + utc.second / 3600)


def from_jd(jd, place):
    y, m, d, h = swe.revjul(jd)
    utc = datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=h)
    return utc.astimezone(place.tz).replace(tzinfo=None)


def sunrise_sunset(date, place):
    """Hindu sunrise: Sun's disc centre with refraction. Returns local datetimes."""
    geo = (place.lon, place.lat, 0)
    start = jd_ut(datetime(date.year, date.month, date.day), place)
    flags = swe.BIT_DISC_CENTER
    rise = swe.rise_trans(start, swe.SUN, swe.CALC_RISE | flags, geo)[1][0]
    noon = swe.rise_trans(rise, swe.SUN, swe.CALC_MTRANSIT, geo)[1][0]
    sset = swe.rise_trans(rise, swe.SUN, swe.CALC_SET | flags, geo)[1][0]
    next_rise = swe.rise_trans(sset, swe.SUN, swe.CALC_RISE | flags, geo)[1][0]
    return {k: from_jd(v, place) for k, v in
            dict(sunrise=rise, noon=noon, sunset=sset, next_sunrise=next_rise).items()}


def ascendant(jd, place):
    return swe.houses_ex(jd, place.lat, place.lon, b"W", FLAGS)[1][0]


def varga_sign(lon, division):
    """Parashari varga rashi for a sidereal longitude."""
    sign, deg = int(lon // 30), lon % 30
    part = int(deg // (30 / division))
    odd = sign % 2 == 0  # Mesha (index 0) is an odd sign
    if division == 1:
        return sign
    if division == 9:
        return int(lon // (30 / 9)) % 12
    if division == 10:
        return (sign + part if odd else sign + 8 + part) % 12
    if division == 7:
        return (sign + part if odd else sign + 6 + part) % 12
    if division == 12:
        return (sign + part) % 12
    raise ValueError(division)


def _spans(start, end, place, division, step_min=1):
    """Contiguous spans where the varga lagna stays the same, to the minute."""
    spans, t = [], start
    cur = varga_sign(ascendant(jd_ut(t, place), place), division)
    span_start = t
    while t < end:
        t += timedelta(minutes=step_min)
        s = varga_sign(ascendant(jd_ut(t, place), place), division)
        if s != cur:
            spans.append({"rashi": RASHIS[cur], "sign": cur, "start": span_start, "end": t})
            cur, span_start = s, t
    spans.append({"rashi": RASHIS[cur], "sign": cur, "start": span_start, "end": end})
    return spans


def lagna_spans(start, end, place):
    return _spans(start, end, place, 1, step_min=2)


def varga_spans(start, end, place, division):
    return _spans(start, end, place, division)


def planet_longitudes(jd):
    out = {name: swe.calc_ut(jd, pid, FLAGS)[0][0] for name, pid in GRAHAS.items()}
    out["Ketu"] = (out["Rahu"] + 180) % 360
    return out


def compute_chart(local_dt, place):
    jd = jd_ut(local_dt, place)
    asc = ascendant(jd, place)
    lons = planet_longitudes(jd)
    return {"time": local_dt, "jd": jd, "asc": asc, "lons": lons,
            "lagna": {d: varga_sign(asc, d) for d in (1, 7, 9, 10, 12)},
            "signs": {d: {g: varga_sign(l, d) for g, l in lons.items()} for d in (1, 7, 9, 10, 12)}}


def ghati_pala(t, sunrise):
    secs = (t - sunrise).total_seconds()
    gh = int(secs // 1440)
    return f"{gh}gh {int((secs - gh * 1440) // 24)}pa"


# ---- Vimshottari ----

def dasha_timeline(chart, levels=3):
    """List of (start, end, (MD, AD, PD)) in local time."""
    moon = chart["lons"]["Chandra"]
    nak = int(moon // NAKSHATRA)
    lord_i = nak % 9
    elapsed = (moon % NAKSHATRA) / NAKSHATRA
    first = DASHA_ORDER[lord_i]
    start = chart["time"] - timedelta(days=elapsed * DASHA_YEARS[first] * YEAR_DAYS)
    out = []

    def split(t0, years, lord_index, depth, path):
        if depth == levels:
            out.append((t0, t0 + timedelta(days=years * YEAR_DAYS), tuple(path)))
            return
        t = t0
        for k in range(9):
            sub = DASHA_ORDER[(lord_index + k) % 9]
            sub_years = years * DASHA_YEARS[sub] / 120
            split(t, sub_years, (lord_index + k) % 9, depth + 1, path + [sub])
            t += timedelta(days=sub_years * YEAR_DAYS)

    t = start
    for k in range(18):  # two full cycles is plenty
        md = DASHA_ORDER[(lord_i + k) % 9]
        split(t, DASHA_YEARS[md], (lord_i + k) % 9, 1, [md])
        t += timedelta(days=DASHA_YEARS[md] * YEAR_DAYS)
    return out


def dasha_at(timeline, date):
    for s, e, path in timeline:
        if s <= date < e:
            return path
    raise ValueError(date)


def gochara_at(date, place):
    """Sidereal rashi of the slow grahas on a date."""
    lons = planet_longitudes(jd_ut(date, place))
    return {g: int(lons[g] // 30) for g in ("Shani", "Guru", "Rahu", "Ketu")}
