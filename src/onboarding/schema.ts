import { z } from 'zod'

export const MAX_QUESTIONS = 12
/** Room for a dictated answer or the events read from a CV. */
export const MAX_ANSWER_LENGTH = 4000
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'] as const

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night', 'unknown'] as const
export const SURENESS = ['sure', 'fairly_sure', 'not_sure'] as const
export const TIME_SOURCES = ['certificate', 'hospital', 'kundli', 'diary', 'memory'] as const

export const birthSchema = z.object({
  date: z.iso.date(),
  place: z.string().trim().min(1).max(200),
  /** A family memory of the time is a soft hint for the rectification, never a search limit. */
  timeOfDay: z.enum(TIMES_OF_DAY).default('unknown'),
  sureness: z.enum(SURENESS).default('not_sure'),
  /** An exact clock time, HH:MM, when the user has one. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  timeSource: z.enum(TIME_SOURCES).nullable().default(null),
  notes: z.string().trim().max(MAX_ANSWER_LENGTH),
})

export const questionSchema = z.object({
  text: z.string().describe('One short question, in plain English, addressed to the user.'),
  hint: z
    .string()
    .nullable()
    .describe('An optional example answer or a gentle nudge, shown under the question.'),
  input: z
    .enum(['text', 'choice', 'date', 'time'])
    .describe('The input the user answers with. Use choice when a few fixed answers cover it.'),
  options: z.array(z.string()).describe('The answers to pick from when input is choice, otherwise empty.'),
})

export const eventSchema = z.object({
  type: z
    .string()
    .describe('What happened, e.g. marriage, first job, job ended, move abroad, father died. A start and an end are two events.'),
  about: z
    .enum(['self', 'father', 'mother', 'sibling', 'grandparent', 'other'])
    .describe('Whose event it is. Cousins, aunts, uncles and friends are other.'),
  date: z.string().describe('As precise as the user gave it: YYYY-MM-DD, YYYY-MM or YYYY.'),
  precision: z.enum(['exact', 'month', 'season', 'year']),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Medium when the user hedged ("I think", "around"). Low for events about other.'),
  notes: z.string(),
})

/** What the Worker reads from an uploaded document: dated events and nothing else. */
export const extractionSchema = z.object({
  events: z.array(eventSchema).describe('Every dated event in the document, oldest first. Empty if there are none.'),
})

export const estimateSchema = z.object({
  earliest: z.string().describe('Start of the likely window, local clock time as HH:MM.'),
  latest: z.string().describe('End of the likely window, local clock time as HH:MM.'),
  bestGuess: z.string().describe('The single most likely time inside the window, as HH:MM.'),
  window: z.enum(['morning', 'afternoon', 'night']),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().describe('Two or three sentences to the user explaining the estimate.'),
  basis: z.array(z.string()).describe('The answers that shaped the estimate most, in plain words.'),
  events: z
    .array(eventSchema)
    .describe('Every dated life event the user mentioned, for the full rectification later.'),
})

export const turnSchema = z.object({
  question: questionSchema.nullable().describe('The next question, or null when giving the estimate.'),
  estimate: estimateSchema.nullable().describe('The estimate, or null while still asking questions.'),
})

export const finalTurnSchema = z.object({
  question: z.null(),
  estimate: estimateSchema,
})

export const answerSchema = z.string().trim().min(1).max(MAX_ANSWER_LENGTH).nullable()

const askedQuestionSchema = z.object({
  text: z.string().max(500),
  hint: z.string().max(500).nullable(),
  input: questionSchema.shape.input,
  options: z.array(z.string().max(200)).max(8),
})

/** What the browser sends: everything asked and answered so far. A null answer is a skip. */
export const historySchema = z.object({
  birth: birthSchema,
  steps: z.array(z.object({ question: askedQuestionSchema, answer: answerSchema })).max(MAX_QUESTIONS),
})

export type Birth = z.infer<typeof birthSchema>
export type Question = z.infer<typeof questionSchema>
export type Estimate = z.infer<typeof estimateSchema>
export type LifeEvent = z.infer<typeof eventSchema>
export type Turn = z.infer<typeof turnSchema>
export type History = z.infer<typeof historySchema>
export type AnsweredStep = History['steps'][number]

export interface OnboardingResult extends History {
  completedAt: string
  estimate: Estimate
}
