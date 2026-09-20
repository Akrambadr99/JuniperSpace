import { describe, expect, it } from 'vitest'
import { initialRegulatorResponseState, rescheduleLegalReview } from './RegulatorResponseControl'

const command = { id: 'review-1', expectedRevision: 0, role: 'Compliance Lead' as const, responseId: 'REG-FCA-204', reviewer: 'Senior privacy counsel', reviewOn: '2026-10-20T18:00:00Z', asOf: '2026-10-20T09:00:00Z', reason: 'Evidence blocker requires senior counsel review before deadline.' }
describe('regulator legal-review control', () => {
  it('reassigns review while preserving its prior schedule and deadline', () => { const next = rescheduleLegalReview(initialRegulatorResponseState, command); expect(next.responses.find((item) => item.responseId === command.responseId)).toMatchObject({ reviewer: 'Senior privacy counsel', reviewOn: command.reviewOn }); expect(next.reviewHistory[0]).toMatchObject({ previousReviewer: 'M. Chen', previousReviewOn: '2026-10-19', deadline: '2026-10-21', immutable: true }) })
  it('rejects non-leads, stale changes and released-response mutation', () => { expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, role: 'Compliance Analyst' })).toThrow('compliance lead'); expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, expectedRevision: 2 })).toThrow('changed'); expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, responseId: 'REG-ICO-099' })).toThrow('immutable') })
  it('keeps retried legal-review commands idempotent', () => { const next = rescheduleLegalReview(initialRegulatorResponseState, command); expect(rescheduleLegalReview(next, command)).toBe(next) })
})
