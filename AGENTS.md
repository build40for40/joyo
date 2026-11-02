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
