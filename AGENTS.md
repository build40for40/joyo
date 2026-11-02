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
