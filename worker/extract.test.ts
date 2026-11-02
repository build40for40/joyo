import { describe, expect, it } from 'vitest'

import { MAX_UPLOAD_BYTES } from '../src/onboarding/schema'
import { checkUpload, toExtractMessages } from './extract'

const pdf = (size = 10) => new File([new Uint8Array(size)], 'cv.pdf', { type: 'application/pdf' })

describe('checkUpload', () => {
  it('accepts a small PDF', () => {
    expect(checkUpload(pdf())).toMatchObject({ ok: true })
  })

  it('rejects a missing file, an unsupported type, an empty file and an oversized one', () => {
    expect(checkUpload(null)).toMatchObject({ ok: false, status: 400 })
    expect(checkUpload('not a file')).toMatchObject({ ok: false, status: 400 })
    expect(checkUpload(new File(['x'], 'cv.docx', { type: 'application/msword' }))).toMatchObject({ ok: false, status: 415 })
    expect(checkUpload(pdf(0))).toMatchObject({ ok: false, status: 400 })
    expect(checkUpload(pdf(MAX_UPLOAD_BYTES + 1))).toMatchObject({ ok: false, status: 413 })
  })
})

describe('toExtractMessages', () => {
  it('sends a PDF as a file part', async () => {
    const [message] = await toExtractMessages(pdf())
    expect(message?.content).toEqual([
      expect.objectContaining({ type: 'file', mediaType: 'application/pdf' }),
      expect.objectContaining({ type: 'text' }),
    ])
  })

  it('sends plain text as text', async () => {
    const [message] = await toExtractMessages(new File(['Started work 2010'], 'notes.txt', { type: 'text/plain' }))
    expect(message?.content).toEqual([
      { type: 'text', text: 'Started work 2010' },
      expect.objectContaining({ type: 'text' }),
    ])
  })
})
