import type { ModelMessage } from 'ai'

import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from '../src/onboarding/schema'

export const EXTRACT_INSTRUCTIONS = `You read one document for Joyo, an app that works out someone's time of birth from the dated events of their life. The document belongs to the user: it might be a CV, an immigration or visa record, a certificate, a letter, a ticket or a photo of any of these.

Return every dated event in the user's life that the document shows, oldest first: jobs and internships starting and ending, studies starting and ending, moves between countries or cities, visa or residency decisions, marriages, births, deaths, operations, and anything else with a date. A start and an end are two events.

- Describe each event in a few plain words, like "started job at a bank" or "moved to another country". Employers, schools and cities are fine to name.
- Never include ID, passport, visa, case or account numbers, street addresses, phone numbers, email addresses, or other people's full names.
- Give each date as precisely as the document does: YYYY-MM-DD, YYYY-MM or YYYY. Dates printed on a document are high confidence.
- Ignore everything that isn't a dated event: skills, descriptions of duties, signatures, stamps without dates.
- If the document has no dated events, return an empty list.`

type UploadCheck = { ok: true; file: File } | { ok: false; status: number; message: string }

/** Only small PDFs, images and plain text go to the model. */
export function checkUpload(value: unknown): UploadCheck {
  if (!(value instanceof File)) return { ok: false, status: 400, message: 'Attach one document to read.' }
  if (!(UPLOAD_TYPES as readonly string[]).includes(value.type))
    return { ok: false, status: 415, message: 'Upload a PDF, a photo or a text file.' }
  if (value.size === 0) return { ok: false, status: 400, message: 'That file is empty.' }
  if (value.size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, message: 'That file is over 10 MB.' }
  return { ok: true, file: value }
}

export async function toExtractMessages(file: File): Promise<ModelMessage[]> {
  const document =
    file.type === 'text/plain'
      ? ({ type: 'text', text: await file.text() } as const)
      : ({ type: 'file', data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type } as const)
  return [{ role: 'user', content: [document, { type: 'text', text: 'List the dated events in this document.' }] }]
}
