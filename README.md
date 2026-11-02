# Joyo

A 40 for 40 app: data input and visualisation, built with Vue 3, TypeScript and Vite.

## Today: Day 01

Joyo helps someone who doesn't know their exact time of birth work it out, using Vedic astrology (Jyotish). It works backwards from their life: the dates when big things happened show which birth time fits best.

What we're building today:

1. **Tell your story.** The user gives their date and place of birth, then their life events (marriage, children, moves, career changes, a parent's death) by typing, speaking or uploading documents like a marriage certificate or a plane ticket.
2. **Three first guesses.** Joyo tests morning, afternoon and night births against those events and gives a short reading for each, so the user can say which sounds like them.
3. **Sharper questions.** Joyo asks the questions that best tell the leading guesses apart, like "What changed at work between March and September 2017?"
4. **Zoom in.** Each round narrows the window, from about two hours down to a few minutes.
5. **Best estimate.** A birth time range with an honest confidence level, and the events that pinned it down.

The AI asks the questions and explains the results. It never calculates planet positions itself: a Vedic (sidereal) astronomy engine does that. The full prompt and rules are in [`src/rectification/system-prompt.md`](src/rectification/system-prompt.md) and [`AGENTS.md`](AGENTS.md).

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # then add your ANTHROPIC_API_KEY
npm run dev                      # Vite and the Worker API together
```

## Check

```sh
npm test          # unit tests, colocated as *.test.ts
npm run build     # type-check and production build
```

## Deploy

Live at https://build40for40.com/joyo. Merging to `main` deploys it, and every pull request gets a public preview link in a comment.
