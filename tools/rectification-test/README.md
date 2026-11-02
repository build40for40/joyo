# Rectification test harness (Python)

The local dry run of `src/rectification/system-prompt.md` from 2 November 2026. It holds the tested reference implementation of the sidereal tools, which the TypeScript port in the Worker should be checked against. It is not part of the app and doesn't deploy.

- `vedic.py`: the Jyotish tools on Swiss Ephemeris, Lahiri ayanamsa: geocode (a small stand-in table), sunrise, lagna and varga spans, chart, Vimshottari dasha, transits.
- `rectify.py`: the prompt's scoring and Stages 1–3.
- `personas.py`: four made-up personas with known birth times. Their events are planted in the periods the true chart favours, so results are a best case.
- `run.py`: each persona through the prompt as written and three variants, with transcripts in `results/`.
- `run_v2.py`: the updated rules (whole calendar day, evidence levels, insufficient result, whole-lagna scoring).
- `seeds.py`: repeats each persona over 10 seeds.
- `REPORT.md`: what the runs found and the prompt changes they led to.
- `export_reference.py`: writes `worker/sky/reference.json`, the Swiss Ephemeris answers the TypeScript sky calculator in the Worker is tested against.

## Run it

```sh
cd tools/rectification-test
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python run.py        # writes results/<variant>/<persona>.md
.venv/bin/python run_v2.py 10  # the updated rules, 10 seeds per persona
.venv/bin/python export_reference.py  # refresh worker/sky/reference.json
```

Only made-up personas belong here. Never commit a real person's birth details or life events.
