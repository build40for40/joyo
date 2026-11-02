# Joyo

A small web app for data input and visualisation. Shared project context, services and rules live in `../AGENTS.md`.

## Stack

- Vue 3 with `<script setup lang="ts">`, built with Vite.
- Vitest with jsdom and `@vue/test-utils`. Unit tests sit next to their source as `*.test.ts`.
- `@/` resolves to `src/`.

## Commands

- `npm run dev`: local dev server.
- `npm test`: unit tests.
- `npm run build`: type-check with `vue-tsc`, then build to `dist/`.

## Hosting

- A Cloudflare Worker named `joyo` serves `dist/` as static assets on the `build40for40.com/joyo` and `build40for40.com/joyo/*` routes. Those routes run before the site's Worker, which owns the rest of the domain.
- Vite builds with `base: '/joyo/'` into `dist/joyo/`, so the asset paths match the URL path.
- CI (`.github/workflows/ci.yml`) tests and builds every push and PR. Pushes to `main` deploy to production. PRs upload a preview version and comment its public `workers.dev` link, which is named after the branch.
- Deploys need the `CLOUDFLARE_API_TOKEN` repo secret. Without it CI still tests and builds, and skips deploying.

## Product: Vedic birth time rectification

Joyo finds a user's birth time by working backwards from their life events, using Vedic astrology (Jyotish). The full system prompt, tool contracts and the `RectificationTurn` JSON schema are in `src/rectification/system-prompt.md`. Keep the prompt there so the app can load it with `import prompt from './system-prompt.md?raw'`.

- **Input:** date and place of birth, plus life events given as text, a voice transcript or uploaded documents (certificates, tickets, dated photos). Documents are read for date, place and event type only.
- **Flow:** intake and event timeline → three macro readings (morning, afternoon, night, measured from local sunrise) → questions that separate the top candidates → narrowing through the D9, D10/D7, D12 and D60 charts, with KP and Jaimini cross-checks → a final time range with a confidence level.
- **The model never does astronomy.** Lagna, graha positions, nakshatras, dashas, vargas and transits come only from the tools listed in the prompt. Every tool runs in sidereal mode with the Lahiri ayanamsa by default. Tropical (Western) output must never reach the model.
- **Vedic only:** the nine grahas, whole-sign houses, graha drishti and Vimshottari dasha. No Uranus, Neptune or Pluto, and no Western aspects.
- **Honest precision:** results are a time range with a confidence level, never a single exact minute presented as certain.
- **Sensitive data:** birth details, deaths, illness and documents are personal. Don't log them in plain text, and don't echo ID numbers or addresses from documents.
