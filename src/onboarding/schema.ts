import { z } from 'zod'

import type { DayScore } from '../../worker/sky/score'

export const MAX_QUESTIONS = 12
/** Events dated to the month or better that the rectification needs before it names a time. */
export const MONTH_DATED_NEEDED = 6
/** Room for a dictated answer or the events read from a CV. */
export const MAX_ANSWER_LENGTH = 4000
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'] as const

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night', 'unknown'] as const
export const SURENESS = ['sure', 'fairly_sure', 'not_sure'] as const
export const TIME_SOURCES = ['certificate', 'hospital', 'kundli', 'diary', 'memory'] as const

export const locationSchema = z.object({
  label: z.string().max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /** IANA time zone, e.g. Europe/London, so historical clock changes apply. */
  tz: z.string().max(100),
})

export const birthSchema = z.object({
  date: z.iso.date(),
  place: z.string().trim().min(1).max(200),
  /** Set when the user picks a place from the search. The Worker looks it up otherwise. */
  location: locationSchema.nullable().default(null),
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

/** Kinds of dated event the rectification scores. Each maps to houses in worker/sky/score.ts. */
export const EVENT_KINDS = [
  'relationship_start',
  'marriage',
  'relationship_end',
  'child_born',
  'job_start',
  'job_end',
  'study_start',
  'study_end',
  'school_change',
  'home_move',
  'property',
  'move_abroad',
  'own_health',
  'money',
  'spiritual',
  'media',
  'parent_health',
  'parent_death',
  'parent_money',
  'sibling_born',
  'sibling_married',
  'sibling_child',
  'grandparent_death',
  'other',
] as const

export const EVENT_ABOUT = ['self', 'father', 'mother', 'sibling', 'grandparent', 'other'] as const

export const eventSchema = z.object({
  kind: z
    .enum(EVENT_KINDS)
    .describe(
      'The closest kind. A job, internship or business starting is job_start; moving abroad or back home from abroad is move_abroad; a retreat, course or meeting a teacher is spiritual; a podcast, broadcast or publication is media; a younger sibling being born is sibling_born. Use other only when nothing fits.',
    ),
  type: z
    .string()
    .describe('What happened, e.g. marriage, first job, job ended, move abroad, father died. A start and an end are two events.'),
  about: z
    .enum(EVENT_ABOUT)
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

const noteSchema = z
  .string()
  .nullable()
  .describe(
    "One short, warm sentence to the user about what their last answer did, grounded in the scoring summary. Null before the first answer.",
  )

export const turnSchema = z.object({
  note: noteSchema,
  question: questionSchema.nullable().describe('The next question, or null when giving the estimate.'),
  estimate: estimateSchema.nullable().describe('The estimate, or null while still asking questions.'),
})

export const finalTurnSchema = z.object({
  note: noteSchema,
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

/** What each onboarding request sends: the history, plus what the Worker has read from it so far. */
export const turnRequestSchema = historySchema.extend({
  /** Dated events read from the answers so far, as the Worker last returned them. */
  events: z.array(eventSchema).max(100).default([]),
  /** The user chose to see their chart now, so the next turn is the estimate. */
  finish: z.boolean().default(false),
})

export type Birth = z.infer<typeof birthSchema>
export type Question = z.infer<typeof questionSchema>
export type Estimate = z.infer<typeof estimateSchema>
export type LifeEvent = z.infer<typeof eventSchema>
export type Location = z.infer<typeof locationSchema>
export type Turn = z.infer<typeof turnSchema>
export type History = z.infer<typeof historySchema>
export type AnsweredStep = History['steps'][number]
export type TurnRequest = z.infer<typeof turnRequestSchema>

export interface OnboardingResult extends History {
  completedAt: string
  estimate: Estimate
  /** The rectification scoring behind the estimate, when the Worker ran it. */
  scoring?: DayScore
}
