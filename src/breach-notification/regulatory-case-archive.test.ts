import { expect, it } from 'vitest'
import { BrowserRegulatorResponsePersistence, captureRegulatoryCaseArchive, initialRegulatorResponseState, regulatoryCaseIntegrity } from './regulator-response-domain'

const command = { id: 'case-archive-1', expectedRevision: 0, responseId: 'REG-FCA-204', role: 'Compliance Lead' as const, createdBy: 'compliance lead', createdOn: '2026-10-29' }

it('pins a regulatory case and keeps later case changes outside its archive', () => {
  const archived = captureRegulatoryCaseArchive(initialRegulatorResponseState, command)
  expect(archived.caseArchives[0]).toMatchObject({ schemaVersion: 1, responseId: command.responseId, sourceRevision: 0, immutable: true })
  expect(captureRegulatoryCaseArchive(archived, command)).toBe(archived)
  const changed = structuredClone(archived)
  changed.responses[0]!.released = true
  expect(changed.caseArchives[0]?.response.released).toBe(false)
  expect(() => captureRegulatoryCaseArchive(archived, { ...command, id: 'case-archive-2' })).toThrow('changed')
  expect(() => captureRegulatoryCaseArchive(initialRegulatorResponseState, { ...command, role: 'Compliance Analyst' })).toThrow('compliance lead')
})

it('blocks broken dispatch and acknowledgement lineage without writing, and loads legacy state', () => {
  const broken = structuredClone(initialRegulatorResponseState)
  broken.closures.push({ id: 'closure-1', responseId: command.responseId, reviewChangeId: 'missing-review', evidenceIds: [], legalApproval: 'legal', complianceApproval: 'compliance', releaseReference: 'RELEASE-1', dispatchEvidence: 'DISPATCH-1', regulatorAcknowledgement: 'ACK-1', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-29', immutable: true })
  expect(regulatoryCaseIntegrity(broken, command.responseId)).toContain('Acknowledged release lacks its legal review or successful dispatch source.')
  expect(() => captureRegulatoryCaseArchive(broken, command)).toThrow('Acknowledged release')
  expect(broken.caseArchives).toEqual([])
  const old = structuredClone(initialRegulatorResponseState) as unknown as Record<string, unknown>
  delete old['caseArchives']
  expect(new BrowserRegulatorResponsePersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()?.caseArchives).toEqual([])
})

it('retains the policies and legacy schedule semantics actually used by a correction', () => {
  const state = structuredClone(initialRegulatorResponseState)
  state.reviewHistory.push({ id: 'legal', responseId: command.responseId, previousReviewer: null, reviewer: 'counsel', previousReviewOn: null, reviewOn: '2026-10-20', reason: 'Independent legal review', deadline: '2026-10-21', immutable: true })
  state.dispatchAttempts.push({ id: 'dispatch', responseId: command.responseId, releaseReference: 'REL-1', releaseRevision: 0, attemptNumber: 1, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'lead', attemptedOn: '2026-10-21', retryOf: null, dispatchEvidence: 'DISPATCH', immutable: true })
  state.closures.push({ id: 'closure', responseId: command.responseId, reviewChangeId: 'legal', evidenceIds: ['EVD-1'], legalApproval: 'LEGAL', complianceApproval: 'COMP', releaseReference: 'REL-1', dispatchEvidence: 'DISPATCH', regulatorAcknowledgement: 'ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-21', immutable: true })
  state.followUpEvents.push({ id: 'follow-up', obligationId: 'obligation', responseId: command.responseId, releaseReference: 'REL-1', obligationType: 'evidence-supplement', deadline: '2026-10-28', owner: 'analyst', stage: 'opened', evidenceReference: 'REQ', actor: 'lead', occurredOn: '2026-10-22', sourceRevision: 0, immutable: true })
  state.followUpDrafts.push({ id: 'draft', obligationId: 'obligation', sourceReleaseReference: 'REL-1', previousDraftId: null, requestedInformation: 'Custody dates', responseStatement: 'Custody evidence requires correction.', evidenceReferences: ['EVD-1'], amendmentReason: null, owner: 'analyst', draftedBy: 'analyst', draftedOn: '2026-10-23', sourceRevision: 0, immutable: true })
  state.followUpReviews.push({ id: 'returned', obligationId: 'obligation', draftId: 'draft', sourceReleaseReference: 'REL-1', decision: 'returned', rationale: 'Correct the custody dates.', reviewer: 'lead', reviewedOn: '2026-10-24', immutable: true })
  state.correctionRequests.push({ id: 'correction', obligationId: 'obligation', returnedReviewId: 'returned', sourceDraftId: 'draft', assignedOwner: 'analyst', requestedChanges: 'Correct dates', evidenceRequirement: 'Custody receipt', dueOn: '2026-10-28', requestedOn: '2026-10-24', authorityPolicyId: 'evidence-supplement:policy-1', immutable: true })
  state.correctionSchedule.push({ id: 'legacy-schedule', correctionRequestId: 'correction', previousOwner: 'analyst', owner: 'senior analyst', previousDueOn: '2026-10-28', dueOn: '2026-11-01', reason: 'Escalated custody evidence recovery.', evidenceReference: 'ESC', escalatedBy: 'lead', escalatedOn: '2026-10-29', immutable: true })
  state.legacyEffectiveScheduleIds = ['legacy-schedule', 'unrelated-schedule']
  const archived = captureRegulatoryCaseArchive(state, command)
  const archive = archived.caseArchives[0]!
  expect(archive.authorityPolicies?.map((item) => item.id)).toEqual(['evidence-supplement:policy-1'])
  expect(archive.legacyEffectiveScheduleIds).toEqual(['legacy-schedule'])
  const missing = structuredClone(state)
  missing.authorityPolicies = []
  expect(() => captureRegulatoryCaseArchive(missing, command)).toThrow('policy revision is missing')
  expect(missing.caseArchives).toEqual([])
  archived.authorityPolicies[2]!.acknowledgementDays = 7
  expect(archive.authorityPolicies?.[0]?.acknowledgementDays).toBe(1)
  const legacy = structuredClone(archived)
  delete legacy.caseArchives[0]!.authorityPolicies
  delete legacy.caseArchives[0]!.legacyEffectiveScheduleIds
  expect(new BrowserRegulatorResponsePersistence({ getItem: () => JSON.stringify(legacy), setItem: () => undefined }).load()?.caseArchives[0]).toEqual(legacy.caseArchives[0])
})
