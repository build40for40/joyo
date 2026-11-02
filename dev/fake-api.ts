import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

/**
 * `npm run fake`: a stand-in for the onboarding Worker, so the whole flow can be clicked through
 * locally with no Anthropic key and no WorkOS sign-in. Questions and estimates are canned.
 */

const API = '/joyo/api/onboarding'

const QUESTIONS = [
  {
    text: 'Is anything written down from the day you were born, like a birth certificate or a baby book?',
    hint: null,
    input: 'choice',
    options: ['Yes', 'No', 'Not sure'],
  },
  {
    text: 'When did you start and leave each school, university and job?',
    hint: 'You can upload a CV instead of typing.',
    input: 'text',
    options: [],
  },
  {
    text: 'Have you moved to another country or city? When did each move happen?',
    hint: 'Visa letters, immigration papers or tickets work too.',
    input: 'text',
    options: [],
  },
  {
    text: 'Have your parents or grandparents had a serious illness, an operation or a death in the family? When?',
    hint: 'Skip this one if you would rather not.',
    input: 'text',
    options: [],
  },
  {
    text: 'Was it light or dark outside when you were born?',
    hint: null,
    input: 'choice',
    options: ['Light', 'Dark', 'Around sunrise or sunset', 'Not sure'],
  },
]

const FAKE_EVENTS = [
  { type: 'started university', about: 'self', date: '2004-10', precision: 'month', confidence: 'high', notes: '' },
  { type: 'finished university', about: 'self', date: '2007-06', precision: 'month', confidence: 'high', notes: '' },
  { type: 'started first job', about: 'self', date: '2008-07', precision: 'month', confidence: 'high', notes: '' },
  { type: 'moved to another country', about: 'self', date: '2017-04-30', precision: 'exact', confidence: 'high', notes: '' },
]

const WINDOWS: Record<string, { earliest: string; latest: string; bestGuess: string }> = {
  morning: { earliest: '06:00', latest: '12:00', bestGuess: '09:00' },
  afternoon: { earliest: '12:00', latest: '17:00', bestGuess: '14:30' },
  evening: { earliest: '17:00', latest: '21:30', bestGuess: '19:00' },
  night: { earliest: '21:00', latest: '05:00', bestGuess: '01:00' },
}

interface FakeHistory {
  birth: { timeOfDay?: string; sureness?: string; time?: string | null; timeSource?: string | null }
  steps: unknown[]
}

let saved: string | null = null

/** With a recorded time, the time questions are skipped and only life events are asked about. */
function questionsFor({ birth }: FakeHistory) {
  const recorded = birth.time && birth.timeSource !== 'memory'
  return recorded ? QUESTIONS.filter((question) => question.input === 'text') : QUESTIONS
}

function windowOf(time: string) {
  const hour = Number(time.slice(0, 2))
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'night'
}

const clock = (minutes: number) => {
  const wrapped = (minutes + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

function around(time: string, spread: number) {
  const at = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  return { earliest: clock(at - spread), latest: clock(at + spread), bestGuess: time }
}

function estimate(history: FakeHistory) {
  const { birth } = history
  if (birth.time) {
    const recorded = birth.timeSource !== 'memory'
    return {
      ...around(birth.time, recorded ? 15 : 60),
      window: windowOf(birth.time),
      confidence: recorded ? 'high' : 'medium',
      summary: recorded
        ? 'A sample estimate from the local fake API, built on your recorded time. Your life events will check it in the full reading.'
        : 'A sample estimate from the local fake API, built on the time someone remembers. The full reading will refine it.',
      basis: [recorded ? `Your ${birth.timeSource} says ${birth.time}` : `Someone remembers ${birth.time}`],
      events: FAKE_EVENTS,
    }
  }
  const hint = birth.sureness !== 'not_sure' ? WINDOWS[birth.timeOfDay ?? ''] : undefined
  const window = hint ?? { earliest: '00:00', latest: '23:59', bestGuess: '12:00' }
  return {
    ...window,
    window: windowOf(window.bestGuess),
    confidence: hint && birth.sureness === 'sure' ? 'medium' : 'low',
    summary: hint
      ? 'A sample first estimate from the local fake API, built on the time of day you were told. The full reading will refine it.'
      : "A sample first estimate from the local fake API. With no time to go on, it covers the whole day for now. The full reading will narrow it.",
    basis: hint ? [`You were told ${birth.timeOfDay}`] : ['No time of day to go on yet'],
    events: FAKE_EVENTS,
  }
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Streams the turn as JSON text in small pieces, like the Worker's text stream. */
async function streamJson(res: ServerResponse, value: unknown) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 24) {
    res.write(text.slice(index, index + 24))
    await wait(20)
  }
  res.end()
}

export function fakeApi(): Plugin {
  return {
    name: 'joyo-fake-api',
    // Only in `vite --mode fake`. Its middleware answers before the proxy to the Worker.
    apply: (_config, { command, mode }) => command === 'serve' && mode === 'fake',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!path?.startsWith(API)) return next()

        if (req.method === 'POST' && path === `${API}/next`) {
          const history = JSON.parse(await readBody(req)) as FakeHistory
          await wait(400)
          const question = questionsFor(history)[history.steps.length]
          if (question) return streamJson(res, { note: null, question, estimate: null })
          const result = estimate(history)
          saved = JSON.stringify({ ...history, estimate: result, completedAt: new Date().toISOString() })
          return streamJson(res, { note: null, question: null, estimate: result })
        }

        if (req.method === 'POST' && path === `${API}/extract`) {
          await readBody(req)
          await wait(1200)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ events: FAKE_EVENTS }))
        }

        if (req.method === 'GET' && path === `${API}/result`) {
          if (!saved) {
            res.writeHead(404)
            return res.end('Not found')
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(saved)
        }

        res.writeHead(404)
        res.end('Not found')
      })
    },
  }
}
