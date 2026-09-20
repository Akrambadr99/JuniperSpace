import { describe, expect, it } from 'vitest'
import { regulatorResponseReadiness, seededRegulatorResponses } from './regulator-readiness'

describe('regulator response readiness', () => {
  it('prioritizes due reviews while exposing evidence blockers', () => {
    const workload = regulatorResponseReadiness(seededRegulatorResponses, '2026-10-20')
    expect(workload[0]).toMatchObject({
      responseId: 'REG-FCA-204',
      priority: 'review-due',
      blockers: ['Missing EVD-DEVICE-7'],
      reviewScheduled: true,
      releaseEligible: false,
    })
  })

  it('preserves an already released response as immutable readiness history', () => {
    const released = regulatorResponseReadiness([seededRegulatorResponses[2]!], '2026-10-20')[0]
    expect(released).toMatchObject({ responseId: 'REG-ICO-099', priority: 'ready', released: true, releaseEligible: false })
  })
})
