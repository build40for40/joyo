"""Robustness check: each persona x several random seeds (different planted dates), per variant."""
import tempfile
from pathlib import Path

import personas
import run
from rectify import OPTIONS

SEEDS = range(10)
tmp = Path(tempfile.mkdtemp())
print("| variant | persona | right lagna | truth in evidence range | median abs error (min) |")
print("|---|---|---|---|---|")
for vname, opts in run.VARIANTS:
    OPTIONS.update(dict(karaka_counts=True, civil_day=False, use_negatives=False), **opts)
    for p in personas.PERSONAS:
        rows = []
        for seed in SEEDS:
            orig = personas.build
            run.build = lambda pp, s=seed: orig(pp, seed=s)
            rows.append(run.run(p, tmp))
            run.build = orig
        errs = sorted(abs(r["err"]) for r in rows)
        print(f"| {vname} | {p['name']} | {sum(r['lagna_ok'] for r in rows)}/{len(rows)} | "
              f"{sum(r['ehit'] for r in rows)}/{len(rows)} | {errs[len(errs) // 2]:.0f} |")
