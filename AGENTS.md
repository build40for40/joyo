# Joyo

A small web app for data input and visualisation. Shared project context, services and rules live in `../AGENTS.md`.

## Stack

- Vue 3 with `<script setup lang="ts">`, built with Vite.
- Vitest with jsdom and `@vue/test-utils`. Unit tests sit next to their source as `*.test.ts`.
- `@/` resolves to `src/`.
- The Worker in `worker/` serves the API under `/joyo/api/*`. It calls Claude through the Vercel AI SDK (`ai` and `@ai-sdk/anthropic`), and the UI streams its structured output with `useObject` from `@ai-sdk/vue`. The zod schemas shared by both sides live in `src/onboarding/schema.ts`.

## Commands

- `npm run dev`: Vite on port 5173 plus `wrangler dev` on 8787, with Vite proxying `/joyo/api` to the Worker. Copy `.dev.vars.example` to `.dev.vars` and add an `ANTHROPIC_API_KEY` first.
- `npm test`: unit tests.
- `npm run build`: type-check with `vue-tsc`, then build to `dist/`.

## Brand and UI

Read [`docs/brand.md`](docs/brand.md) before building or styling any screen, including the onboarding. The short version:

- **Mood:** a starry night sky with a mood ring glowing on it. Calm page, vibrant data. Action beats anxiety: Joyo answers "when is a good time to act?", never "what bad thing will happen?".
- **Tokens only:** colours, fonts, radii, spacing and motion are `--joyo-*` variables in `src/styles/tokens.css`. Global element styles live in `src/styles/base.css`. Components use the variables and never hard-code hex values.
- **Dark only:** night background with the `StarField` component. No light theme, white cards, whole-page gradients, glassmorphism or default browser form styles.
- **Colour meaning:** gold is action (primary button, selected, focus), with one gold primary button per screen. The 8-step mood scale is for data only and never reorders. Indigo means resting, not bad. Never green, pure red, black, grey or white. Errors are soft coral text with an icon. No Pantone names or numbers.
- **Type:** Marcellus for titles, questions and big readouts. Manrope for everything else (buttons 600). IBM Plex Mono with `tabular-nums` for times, ranges and confidence.
- **Onboarding:** one question per screen in a centred card, not a chat. Sensitive questions (deaths, illness, divorce) are asked kindly and always offer "Skip this one".
- **Wheel:** 12 fixed houses, house 1 at 9 o'clock running anticlockwise, only the sign ring rotates. Wedges blend through the mood scale, labels describe actions ("Let go", not "Loss"), houses 6 and 8 clamp to mid scale, and a Resting → Steady → Active legend is always shown.
- **Copy:** plain, warm, short. No fear words ("bad", "danger", "malefic"). Results always say "This is a best fit to the events you gave, not a certainty."
- **Accessibility:** 4.5:1 contrast, gold focus ring, never colour alone, respect `prefers-reduced-motion`, 44px tap targets, works at 375px with a 16px gutter.

## Hosting

- A Cloudflare Worker named `joyo` serves `dist/` as static assets on the `build40for40.com/joyo` and `build40for40.com/joyo/*` routes. Those routes run before the site's Worker, which owns the rest of the domain.
- Vite builds with `base: '/joyo/'` into `dist/joyo/`, so the asset paths match the URL path.
- CI (`.github/workflows/ci.yml`) tests and builds every push and PR. Pushes to `main` deploy to production. PRs upload a preview version and comment its public `workers.dev` link, which is named after the branch.
- Deploys need the `CLOUDFLARE_API_TOKEN` repo secret. Without it CI still tests and builds, and skips deploying.
- The Worker needs the `ANTHROPIC_API_KEY` Cloudflare secret. The `RESULTS` KV binding is the `joyo-onboarding` namespace, which previews share with production.

## Onboarding

The first question (date, place and anything known about the time) is hardcoded in `BirthStep.vue` and needs no account. Then the user signs in with WorkOS AuthKit (`@workos-inc/authkit-js`, hosted sign-in), and Claude Sonnet 5.5 picks each question from the answers so far, one per screen, finishing with a rough birth time window and confidence. Its prompt is `worker/onboarding-prompt.md`.

- **State lives in the browser.** The birth details and every question and answer are a draft in `localStorage`, which also carries them across the sign-in redirect. Each step POSTs the whole history, and the Worker keeps nothing between turns.
- **Auth:** every API route needs `Authorization: Bearer <access token>`. The Worker verifies it with `jose` against `https://api.workos.com/sso/jwks/<client id>` and the issuer `https://api.workos.com/user_management/<client id>`, and the user id is the token's `sub`. `src/onboarding/workos.ts` picks the client id for both sides by hostname: the production WorkOS environment on build40for40.com, staging on localhost and PR previews. `wrangler dev` shows the Worker the production hostname, so `.dev.vars` sets `WORKOS_CLIENT_ID` to the staging client. Never store the email.
- `POST /joyo/api/onboarding/next` takes `{ birth, steps }`, checks it against `historySchema` and size caps, and streams the next `Turn`: a question or the estimate. After `MAX_QUESTIONS` it can only return the estimate.
- When the model returns the estimate, the Worker itself writes `{ birth, steps, estimate, completedAt }` to KV under `result:<userId>`, so the browser can't forge a result. That is the only thing in KV, and it feeds the visualisation step.
- `GET /joyo/api/onboarding/result` returns the signed-in user's result, or 404.
- Onboarding never does astronomy either. It gathers evidence and gives an honest window, and the rectification flow below refines it.

## Product: Vedic birth time rectification

Joyo finds a user's birth time by working backwards from their life events, using Vedic astrology (Jyotish). The full system prompt, tool contracts and the `RectificationTurn` JSON schema are in `src/rectification/system-prompt.md`. Keep the prompt there so the app can load it with `import prompt from './system-prompt.md?raw'`.

- **Input:** date and place of birth, plus life events given as text, a voice transcript or uploaded documents (certificates, tickets, dated photos). Documents are read for date, place and event type only.
- **Flow:** intake and event timeline → three macro readings (morning, afternoon, night, measured from local sunrise) → questions that separate the top candidates → narrowing through the D9, D10/D7, D12 and D60 charts, with KP and Jaimini cross-checks → a final time range with a confidence level.
- **The model never does astronomy.** Lagna, graha positions, nakshatras, dashas, vargas and transits come only from the tools listed in the prompt. Every tool runs in sidereal mode with the Lahiri ayanamsa by default. Tropical (Western) output must never reach the model.
- **Vedic only:** the nine grahas, whole-sign houses, graha drishti and Vimshottari dasha. No Uranus, Neptune or Pluto, and no Western aspects.
- **Honest precision:** results are a time range with a confidence level, never a single exact minute presented as certain.
- **Sensitive data:** birth details, deaths, illness and documents are personal. Don't log them in plain text, and don't echo ID numbers or addresses from documents.
