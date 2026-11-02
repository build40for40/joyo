"""Writes worker/sky/scoring-reference.json: the Python scores the TypeScript scoring is tested against.

For each made-up persona: its place, true birth time, planted events, and the score
rectify.score_event gives each event at a spread of birth times through the day.

    .venv/bin/python export_scoring.py
"""
import json
from datetime import timedelta
from pathlib import Path

from personas import PERSONAS, build
from rectify import OPTIONS, score_event
from vedic import PLACES, compute_chart, dasha_timeline

OUT = Path(__file__).resolve().parents[2] / "worker" / "sky" / "scoring-reference.json"
OPTIONS.update(karaka_counts=True, civil_day=True, use_negatives=False)

# Python event types and the TypeScript event kinds they become
KINDS = {"vivaha": "marriage", "santana": "child_born", "karma": "job_start", "vidya": "study_start",
         "griha": "home_move", "videsha": "move_abroad", "roga": "own_health",
         "pita_death": "parent_death", "mata_death": "parent_death"}
ABOUT = {"pita_death": "father", "mata_death": "mother"}


def persona(p):
    place, events = build(p)
    lat, lon, tz = PLACES[p["place"]]
    day = p["true"].replace(hour=0, minute=0)
    times = [p["true"]] + [day + timedelta(minutes=m) for m in range(17, 1440, 97)]
    scores = []
    for t in times:
        chart = compute_chart(t, place)
        timeline = dasha_timeline(chart)
        scores.append({"local": t.strftime("%Y-%m-%dT%H:%M"),
                       "events": {e["id"]: score_event(chart, timeline, e, place) for e in events}})
    return {
        "name": p["name"],
        "place": {"lat": lat, "lon": lon, "tz": tz},
        "true": p["true"].strftime("%Y-%m-%dT%H:%M"),
        "events": [{"id": e["id"], "kind": KINDS[e["type"]], "about": ABOUT.get(e["type"], "self"),
                    "start": e["date_start"].strftime("%Y-%m-%d"), "end": e["date_end"].strftime("%Y-%m-%d"),
                    "precision": e["precision"], "confidence": e["confidence"], "hidden": e["hidden"]}
                   for e in events],
        "scores": scores,
    }


if __name__ == "__main__":
    data = {"personas": [persona(p) for p in PERSONAS]}
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {OUT}")
