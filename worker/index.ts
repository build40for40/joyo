import { createAnthropic } from '@ai-sdk/anthropic'
import { createTextStreamResponse, generateText, Output, streamText, toTextStream } from 'ai'

import { extractionSchema, finalTurnSchema, historySchema, turnSchema } from '../src/onboarding/schema'
import { workosClientId } from '../src/onboarding/workos'
import { authenticate, workosIssuer, workosKeys } from './auth'
import { checkUpload, EXTRACT_INSTRUCTIONS, toExtractMessages } from './extract'
import { isLastTurn, LAST_TURN_INSTRUCTION, toModelMessages } from './messages'
import onboardingPrompt from './onboarding-prompt.md'
import { resultKey, saveResult } from './results'

interface Env {
  RESULTS: KVNamespace
  ANTHROPIC_API_KEY: string
  /** Set in .dev.vars, because wrangler dev shows the Worker the production hostname. */
  WORKOS_CLIENT_ID?: string
}

const API = '/joyo/api/onboarding'
const MODEL = 'claude-sonnet-5-5'
const MAX_BODY_LENGTH = 64_000

export default {
  async fetch(request, env, ctx) {
    const { hostname, pathname } = new URL(request.url)
    const clientId = env.WORKOS_CLIENT_ID || workosClientId(hostname)
    const userId = await authenticate(request, workosKeys(clientId), workosIssuer(clientId))
    if (!userId) return new Response('Sign in to continue.', { status: 401 })

    if (request.method === 'POST' && pathname === `${API}/next`) return next(request, env, ctx, userId)
    if (request.method === 'POST' && pathname === `${API}/extract`) return extract(request, env)
    if (request.method === 'GET' && pathname === `${API}/result`) return getResult(env, userId)
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>

async function getResult(env: Env, userId: string) {
  const result = await env.RESULTS.get(resultKey(userId))
  if (!result) return new Response('Not found', { status: 404 })
  return new Response(result, { headers: { 'Content-Type': 'application/json' } })
}

async function next(request: Request, env: Env, ctx: ExecutionContext, userId: string) {
  const body = await request.text()
  if (body.length > MAX_BODY_LENGTH) return new Response('That is too much to send at once.', { status: 413 })

  const parsed = historySchema.safeParse(parseJson(body))
  if (!parsed.success) return new Response('Those answers could not be read.', { status: 400 })
  const history = parsed.data
  const lastTurn = isLastTurn(history)

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const result = streamText({
    model: anthropic(MODEL),
    instructions: lastTurn ? `${onboardingPrompt}\n\n${LAST_TURN_INSTRUCTION}` : onboardingPrompt,
    messages: toModelMessages(history),
    output: Output.object({ schema: lastTurn ? finalTurnSchema : turnSchema, name: 'turn' }),
    providerOptions: {
      anthropic: { effort: 'medium', fallbacks: 'default', cacheControl: { type: 'ephemeral' } },
    },
    // The default handler logs the whole request, which holds the user's birth details.
    onError: ({ error }) => console.error('Onboarding turn failed:', errorName(error)),
    onEnd: ({ output }) => {
      if (!output?.estimate) return
      ctx.waitUntil(
        saveResult(env.RESULTS, userId, history, output.estimate, new Date()).catch((error: unknown) =>
          console.error('Onboarding result was not saved:', errorName(error)),
        ),
      )
    },
  })

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })
}

/** Reads dated events from one uploaded document. The document itself is never stored or logged. */
async function extract(request: Request, env: Env) {
  const form = await request.formData().catch(() => null)
  const upload = checkUpload(form?.get('file') ?? null)
  if (!upload.ok) return new Response(upload.message, { status: upload.status })

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const { output } = await generateText({
      model: anthropic(MODEL),
      instructions: EXTRACT_INSTRUCTIONS,
      messages: await toExtractMessages(upload.file),
      output: Output.object({ schema: extractionSchema, name: 'events' }),
      providerOptions: { anthropic: { effort: 'low', fallbacks: 'default' } },
    })
    return Response.json(output)
  } catch (error) {
    // The default error carries the request, which holds the document.
    console.error('Document extraction failed:', errorName(error))
    return new Response("We couldn't read that document.", { status: 502 })
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : 'Unknown error'
}
