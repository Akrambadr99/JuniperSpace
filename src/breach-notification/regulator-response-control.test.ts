import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegulatorResponseControl } from './RegulatorResponseControl'
import { describe, expect, it } from 'vitest'
import { acknowledgeCorrectionEscalation, BrowserRegulatorResponsePersistence, closeRegulatoryObligation, compareRegulatorFollowUpDrafts, correctionAssignment, draftRegulatoryFollowUp, escalateCorrectionDeadline, getDispatchRecoveryStatus, getRegulatoryFollowUpObligations, getRegulatoryFollowUpReviewReadiness, initialRegulatorResponseState, queryResponseEvidenceTimeline, recordRegulatoryFollowUp, regulatoryCaseIntegrity, recordResponseDispatchAttempt, recordCorrectionAuthorityFollowUp, recoverUnacknowledgedCorrectionHandoff, rescheduleLegalReview, reviseCorrectionAuthorityPolicy, reviewRegulatoryFollowUpDraft, type RegulatoryFollowUpStage } from './regulator-response-domain'

it('recovers an overdue unacknowledged correction handoff without transferring ownership prematurely', () => {
  const base = structuredClone(initialRegulatorResponseState)
  base.followUpDrafts.push({ id: 'draft-1', obligationId: 'OBL-204-A', sourceReleaseReference: 'REL-204', previousDraftId: null, requestedInformation: 'Custody evidence', responseStatement: 'Original draft requires corrected custody dates.', evidenceReferences: ['EVD-7'], amendmentReason: null, owner: 'Regulatory liaison', draftedBy: 'analyst', draftedOn: '2026-10-26', sourceRevision: 0, immutable: true })
  base.correctionRequests.push({ id: 'correction-1', obligationId: 'OBL-204-A', returnedReviewId: 'return-1', sourceDraftId: 'draft-1', assignedOwner: 'Regulatory liaison', requestedChanges: 'Correct custody dates', evidenceRequirement: 'Sealed transfer evidence', dueOn: '2026-10-28', requestedOn: '2026-10-26', immutable: true })
  base.correctionSchedule.push({ id: 'first-handoff', correctionRequestId: 'correction-1', previousOwner: 'Regulatory liaison', owner: 'Senior liaison', previousDueOn: '2026-10-28', dueOn: '2026-10-31', reason: 'Original correction deadline passed without verified evidence.', evidenceReference: 'ESC-1', escalatedBy: 'Compliance lead', escalatedOn: '2026-10-29', immutable: true })
  const command = { id: 'replacement-handoff', expectedRevision: 0, role: 'Compliance Lead' as const, scheduleId: 'first-handoff', replacementOwner: 'Duty manager', dueOn: '2026-11-05', reason: 'Senior liaison missed the acceptance deadline for the correction.', evidenceReference: 'ESC-2', escalatedBy: 'Compliance lead', asOf: '2026-11-01' }
  expect(() => recoverUnacknowledgedCorrectionHandoff(base, { ...command, asOf: '2026-10-31' })).toThrow('Overdue')
  expect(base.correctionSchedule).toHaveLength(1)
  const recovered = recoverUnacknowledgedCorrectionHandoff(base, command)
  expect(recovered.correctionSchedule[1]).toMatchObject({ replacesUnacknowledgedId: 'first-handoff', previousOwner: 'Regulatory liaison', owner: 'Duty manager', immutable: true })
  expect(correctionAssignment(recovered, 'correction-1')).toMatchObject({ owner: 'Regulatory liaison', pendingOwner: 'Duty manager' })
  expect(() => acknowledgeCorrectionEscalation(recovered, { id: 'stale-ack', expectedRevision: recovered.revision, role: 'Compliance Analyst', scheduleId: 'first-handoff', owner: 'Senior liaison', evidenceReference: 'ACK-OLD', acknowledgedBy: 'Senior liaison', acknowledgedOn: '2026-11-01' })).toThrow('current unresolved')
  const accepted = acknowledgeCorrectionEscalation(recovered, { id: 'new-ack', expectedRevision: recovered.revision, role: 'Compliance Analyst', scheduleId: 'replacement-handoff', owner: 'Duty manager', evidenceReference: 'ACK-NEW', acknowledgedBy: 'Duty manager', acknowledgedOn: '2026-11-01' })
  expect(correctionAssignment(accepted, 'correction-1')).toMatchObject({ owner: 'Duty manager', pendingOwner: null })
  expect(accepted.correctionSchedule).toEqual(recovered.correctionSchedule)
  expect(recoverUnacknowledgedCorrectionHandoff(recovered, command)).toBe(recovered)
})

const command = { id: 'review-1', expectedRevision: 0, role: 'Compliance Lead' as const, responseId: 'REG-FCA-204', reviewer: 'Senior privacy counsel', reviewOn: '2026-10-20T18:00:00Z', asOf: '2026-10-20T09:00:00Z', reason: 'Evidence blocker requires senior counsel review before deadline.' }
it('escalates an overdue returned correction while preserving the review and prior deadline', () => { const base = structuredClone(initialRegulatorResponseState); base.closures.push({ id: 'closure-1', responseId: 'REG-FCA-204', reviewChangeId: 'review-1', evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'LEGAL', complianceApproval: 'COMP', releaseReference: 'REL-204', dispatchEvidence: 'DISPATCH', regulatorAcknowledgement: 'ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20', immutable: true }); let state = recordRegulatoryFollowUp(base, { id: 'open-1', expectedRevision: base.revision, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: 'REG-FCA-204', releaseReference: 'REL-204', obligationType: 'evidence-supplement', deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'opened', evidenceReference: 'REQ', actor: 'lead', occurredOn: '2026-10-21' }); state = draftRegulatoryFollowUp(state, { id: 'draft-1', expectedRevision: state.revision, role: 'Compliance Analyst', obligationId: 'OBL-204-A', requestedInformation: 'Confirm sealed device custody', responseStatement: 'The device remained in controlled custody through review.', evidenceReferences: ['EVD-DEVICE-7'], amendmentReason: null, owner: 'Regulatory liaison', draftedBy: 'analyst', draftedOn: '2026-10-26' }); state = reviewRegulatoryFollowUpDraft(state, { id: 'returned-1', expectedRevision: state.revision, role: 'Compliance Lead', obligationId: 'OBL-204-A', draftId: 'draft-1', decision: 'returned', rationale: 'Custody date requires an evidence correction.', reviewer: 'lead', reviewedOn: '2026-10-26' }); const event = { id: 'escalate-1', expectedRevision: state.revision, role: 'Compliance Lead' as const, correctionRequestId: 'returned-1:correction', owner: 'Senior liaison', dueOn: '2026-10-31', reason: 'Original correction deadline passed without verified custody evidence.', evidenceReference: 'ESCALATION-1', escalatedBy: 'lead', escalatedOn: '2026-10-29' }; expect(correctionAssignment(state, event.correctionRequestId)?.overdue('2026-10-29')).toBe(true); expect(() => escalateCorrectionDeadline(state, { ...event, role: 'Compliance Analyst' })).toThrow('compliance lead'); const escalated = escalateCorrectionDeadline(state, event); expect(escalated.correctionRequests).toEqual(state.correctionRequests); expect(escalated.followUpReviews).toEqual(state.followUpReviews); expect(escalated.correctionSchedule[0]).toMatchObject({ previousOwner: 'Regulatory liaison', previousDueOn: '2026-10-28', owner: 'Senior liaison', dueOn: '2026-10-31', immutable: true }); expect(correctionAssignment(escalated, event.correctionRequestId)?.overdue('2026-10-29')).toBe(true); expect(correctionAssignment(escalated, event.correctionRequestId)?.pendingOwner).toBe('Senior liaison'); const receipt = { id: 'ack-1', expectedRevision: escalated.revision, role: 'Compliance Analyst' as const, scheduleId: event.id, owner: 'Senior liaison', evidenceReference: 'HANDOFF-RECEIPT', acknowledgedBy: 'Senior liaison', acknowledgedOn: '2026-10-29' }; expect(() => acknowledgeCorrectionEscalation(escalated, { ...receipt, owner: 'wrong' })).toThrow('Assigned owner'); const acknowledged = acknowledgeCorrectionEscalation(escalated, receipt); expect(correctionAssignment(acknowledged, event.correctionRequestId)?.overdue('2026-10-29')).toBe(false); const amended = draftRegulatoryFollowUp(acknowledged, { id: 'draft-2', expectedRevision: acknowledged.revision, role: 'Compliance Analyst', obligationId: 'OBL-204-A', requestedInformation: 'Confirm sealed device custody', responseStatement: 'The device custody date was corrected using sealed transfer records.', evidenceReferences: ['EVD-DEVICE-7', 'EVD-CUSTODY-8'], amendmentReason: 'Corrected custody date after escalation.', owner: 'Senior liaison', draftedBy: 'analyst', draftedOn: '2026-10-30' }); expect(amended.followUpDrafts.at(-1)).toMatchObject({ correctionRequestId: event.correctionRequestId, previousDraftId: 'draft-1' }); expect(() => escalateCorrectionDeadline(amended, { ...event, id: 'late', expectedRevision: amended.revision })).toThrow('unresolved'); expect(escalateCorrectionDeadline(escalated, event)).toBe(escalated) })
it('loads legacy regulator response without correction schedule events', () => { const storage = { getItem: () => JSON.stringify({ ...initialRegulatorResponseState, correctionSchedule: undefined }), setItem: () => undefined }; expect(new BrowserRegulatorResponsePersistence(storage).load()?.correctionSchedule).toEqual([]) })
describe('regulator legal-review control', () => {
  it('reassigns review while preserving its prior schedule and deadline', () => { const next = rescheduleLegalReview(initialRegulatorResponseState, command); expect(next.responses.find((item) => item.responseId === command.responseId)).toMatchObject({ reviewer: 'Senior privacy counsel', reviewOn: command.reviewOn }); expect(next.reviewHistory[0]).toMatchObject({ previousReviewer: 'M. Chen', previousReviewOn: '2026-10-19', deadline: '2026-10-21', immutable: true }) })
  it('rejects non-leads, stale changes and released-response mutation', () => { expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, role: 'Compliance Analyst' })).toThrow('compliance lead'); expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, expectedRevision: 2 })).toThrow('changed'); expect(() => rescheduleLegalReview(initialRegulatorResponseState, { ...command, responseId: 'REG-ICO-099' })).toThrow('immutable') })
  it('keeps retried legal-review commands idempotent', () => { const next = rescheduleLegalReview(initialRegulatorResponseState, command); expect(rescheduleLegalReview(next, command)).toBe(next) })
})

describe('post-acknowledgement regulator follow-up', () => {
  function acknowledgedRelease() { const reviewed = rescheduleLegalReview(initialRegulatorResponseState, command); const dispatched = recordResponseDispatchAttempt(reviewed, { id: 'followup-dispatch', expectedRevision: 1, role: 'Compliance Lead', responseId: command.responseId, releaseReference: 'REL-204', releaseRevision: 1, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'dispatch service', attemptedOn: '2026-10-20T19:30:00Z', retryOf: null, dispatchEvidence: 'DISPATCH-204' }); return closeRegulatoryObligation(dispatched, { id: 'followup-close', expectedRevision: 2, role: 'Compliance Lead', responseId: command.responseId, evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'LEGAL-204', complianceApproval: 'COMP-204', releaseReference: 'REL-204', dispatchEvidence: 'DISPATCH-204', regulatorAcknowledgement: 'ACK-204', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20T20:00:00Z' }) }
  const stages: RegulatoryFollowUpStage[] = ['opened', 'drafted', 'approved', 'dispatched', 'acknowledged', 'closed']
  it('retains obligation-specific amendment drafts and requires latest review evidence', () => { const closed = acknowledgedRelease(); const opened = recordRegulatoryFollowUp(closed, { id: 'opened-draft', expectedRevision: 3, role: 'Compliance Lead', obligationId: 'OBL-DRAFT', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request', deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'opened', evidenceReference: 'REQUEST-204', actor: 'lead', occurredOn: '2026-10-21' }); const draft = { id: 'draft-1', expectedRevision: 4, role: 'Compliance Analyst' as const, obligationId: 'OBL-DRAFT', requestedInformation: 'Explain device custody after containment.', responseStatement: 'The device remained sealed under controlled evidence custody.', evidenceReferences: ['EVD-DEVICE-7'], amendmentReason: null, owner: 'Regulatory liaison', draftedBy: 'analyst', draftedOn: '2026-10-22' }; const first = draftRegulatoryFollowUp(opened, draft); expect(() => draftRegulatoryFollowUp(first, { ...draft, id: 'draft-invalid', expectedRevision: 5 })).toThrow('amendment reason'); const amended = draftRegulatoryFollowUp(first, { ...draft, id: 'draft-2', expectedRevision: 5, responseStatement: 'The sealed device remained under independent custody.', evidenceReferences: ['EVD-DEVICE-7', 'EVD-CUSTODY-8'], amendmentReason: 'Corrected custody timeline after legal review.' }); expect(compareRegulatorFollowUpDrafts(amended, 'OBL-DRAFT')).toMatchObject({ current: { previousDraftId: 'draft-1', sourceReleaseReference: 'REL-204' }, changedStatement: true, addedEvidence: ['EVD-CUSTODY-8'] }); const drafted = recordRegulatoryFollowUp(amended, { id: 'stage-drafted', expectedRevision: 6, role: 'Compliance Lead', obligationId: 'OBL-DRAFT', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request', deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'drafted', evidenceReference: 'draft-2', actor: 'lead', occurredOn: '2026-10-22' }); expect(() => recordRegulatoryFollowUp(drafted, { id: 'stage-approved', expectedRevision: 7, role: 'Compliance Lead', obligationId: 'OBL-DRAFT', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request', deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'approved', evidenceReference: 'draft-1', actor: 'lead', occurredOn: '2026-10-23' })).toThrow('latest obligation-specific draft') })
  it('retains the complete follow-up lineage against the acknowledged release', () => { let state = acknowledgedRelease(); stages.forEach((stage, index) => { state = recordRegulatoryFollowUp(state, { id: `followup-${String(index)}`, expectedRevision: state.revision, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'evidence-supplement', deadline: '2026-10-28', owner: 'Regulatory liaison', stage, evidenceReference: `FOLLOWUP-EVD-${String(index)}`, actor: 'compliance lead', occurredOn: `2026-10-2${String(index + 1)}` }) }); expect(getRegulatoryFollowUpObligations(state, '2026-10-29')).toMatchObject([{ obligationId: 'OBL-204-A', status: 'closed', overdue: false, history: [{ stage: 'opened', immutable: true }, { stage: 'drafted' }, { stage: 'approved' }, { stage: 'dispatched' }, { stage: 'acknowledged' }, { stage: 'closed' }] }]) })
  it('returns an obligation draft for amendment and requires approved review of the latest version', () => {
    const base = acknowledgedRelease()
    const event = { id: 'opened-review', expectedRevision: base.revision, role: 'Compliance Lead' as const, obligationId: 'OBL-REVIEW', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request' as const, deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'opened' as const, evidenceReference: 'REQUEST-204', actor: 'lead', occurredOn: '2026-10-21' }
    const opened = recordRegulatoryFollowUp(base, event)
    const draft = { id: 'review-draft-1', expectedRevision: opened.revision, role: 'Compliance Analyst' as const, obligationId: 'OBL-REVIEW', requestedInformation: 'Explain device evidence custody.', responseStatement: 'The device remained sealed throughout the regulator review.', evidenceReferences: ['EVD-DEVICE-7'], amendmentReason: null, owner: 'Regulatory liaison', draftedBy: 'analyst', draftedOn: '2026-10-22' }
    const first = draftRegulatoryFollowUp(opened, draft)
    const review = { id: 'review-return', expectedRevision: first.revision, role: 'Compliance Lead' as const, obligationId: 'OBL-REVIEW', draftId: draft.id, decision: 'returned' as const, rationale: 'Custody date requires correction.', reviewer: 'lead', reviewedOn: '2026-10-23' }
    expect(() => reviewRegulatoryFollowUpDraft(first, { ...review, role: 'Compliance Analyst' })).toThrow('compliance lead')
    const returned = reviewRegulatoryFollowUpDraft(first, review)
    expect(returned.followUpReviews[0]).toMatchObject({ draftId: draft.id, decision: 'returned', immutable: true })
    expect(returned.correctionRequests[0]).toMatchObject({ returnedReviewId: review.id, sourceDraftId: draft.id, assignedOwner: 'Regulatory liaison', requestedChanges: review.rationale, dueOn: event.deadline, immutable: true })
    expect(() => draftRegulatoryFollowUp(returned, { ...draft, id: 'wrong-owner', expectedRevision: returned.revision, amendmentReason: 'Corrected the dated chain of custody.', responseStatement: 'The sealed device was transferred under documented custody.', owner: 'Other liaison' })).toThrow('Assigned correction')
    expect(getRegulatoryFollowUpReviewReadiness(returned, 'OBL-REVIEW')?.sourceRelease).toMatchObject({ legalApproval: 'LEGAL-204', complianceApproval: 'COMP-204' })
    expect(getRegulatoryFollowUpReviewReadiness(returned, 'OBL-REVIEW')?.blockers).toContain('Current draft returned for correction')
    const amended = draftRegulatoryFollowUp(returned, { ...draft, id: 'review-draft-2', expectedRevision: returned.revision, amendmentReason: 'Corrected the dated chain of custody.', responseStatement: 'The sealed device was transferred under documented custody.' })
    expect(amended.followUpDrafts.at(-1)).toMatchObject({ previousDraftId: draft.id, correctionRequestId: 'review-return:correction' })
    const approved = reviewRegulatoryFollowUpDraft(amended, { ...review, id: 'review-approve', expectedRevision: amended.revision, draftId: 'review-draft-2', decision: 'approved', rationale: 'Corrected custody date and evidence reviewed.' })
    const drafted = recordRegulatoryFollowUp(approved, { ...event, id: 'stage-drafted-review', expectedRevision: approved.revision, stage: 'drafted', evidenceReference: 'review-draft-2' })
    expect(() => recordRegulatoryFollowUp(amended, { ...event, id: 'stage-drafted-review', expectedRevision: amended.revision, stage: 'approved', evidenceReference: 'review-draft-2' })).toThrow('must preserve')
    const released = recordRegulatoryFollowUp(drafted, { ...event, id: 'stage-approved-review', expectedRevision: drafted.revision, stage: 'approved', evidenceReference: 'review-draft-2' })
    expect(released.followUpEvents.at(-1)).toMatchObject({ stage: 'approved', evidenceReference: 'review-draft-2' })
    expect(getRegulatoryFollowUpReviewReadiness(released, 'OBL-REVIEW')).toMatchObject({ blockers: [], dispatchReady: true })
    expect(released.followUpReviews).toHaveLength(2)
    expect(opened.followUpReviews).toHaveLength(0)
  })
  it('requires the exact release and ordered independent approval before dispatch', () => { const closed = acknowledgedRelease(); expect(() => recordRegulatoryFollowUp(closed, { id: 'bad-release', expectedRevision: 3, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: command.responseId, releaseReference: 'REL-OTHER', obligationType: 'information-request', deadline: '2026-10-21', owner: 'Regulatory liaison', stage: 'opened', evidenceReference: 'OPEN', actor: 'lead', occurredOn: '2026-10-21' })).toThrow('acknowledged immutable'); const opened = recordRegulatoryFollowUp(closed, { id: 'opened', expectedRevision: 3, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request', deadline: '2026-10-21', owner: 'Regulatory liaison', stage: 'opened', evidenceReference: 'OPEN', actor: 'lead', occurredOn: '2026-10-21' }); expect(getRegulatoryFollowUpObligations(opened, '2026-10-22')[0]).toMatchObject({ status: 'opened', overdue: true }); expect(() => recordRegulatoryFollowUp(opened, { id: 'skip-approval', expectedRevision: 4, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: command.responseId, releaseReference: 'REL-204', obligationType: 'information-request', deadline: '2026-10-21', owner: 'Regulatory liaison', stage: 'dispatched', evidenceReference: 'SEND', actor: 'lead', occurredOn: '2026-10-22' })).toThrow('must preserve') })
})
describe('regulatory obligation closure', () => {
  const dispatch = { id: 'dispatch-1', expectedRevision: 1, role: 'Compliance Lead' as const, responseId: 'REG-FCA-204', releaseReference: 'REL-204', releaseRevision: 1, status: 'succeeded' as const, failureClassification: null, retryEligible: false, actor: 'dispatch service', attemptedOn: '2026-10-20T19:30:00Z', retryOf: null, dispatchEvidence: 'DISPATCH-204' }
  const closure = { id: 'close-1', expectedRevision: 2, role: 'Compliance Lead' as const, responseId: 'REG-FCA-204', evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'LEGAL-204', complianceApproval: 'COMP-204', releaseReference: 'REL-204', dispatchEvidence: 'DISPATCH-204', regulatorAcknowledgement: 'ACK-204', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20T20:00:00Z' }
  const dispatched = () => recordResponseDispatchAttempt(rescheduleLegalReview(initialRegulatorResponseState, command), dispatch)
  it('separately preserves approval, release, durable dispatch, and acknowledgement evidence', () => { const closed = closeRegulatoryObligation(dispatched(), closure); expect(closed.responses.find((item) => item.responseId === 'REG-FCA-204')).toMatchObject({ released: true, missingEvidence: [] }); expect(closed.dispatchAttempts[0]).toMatchObject({ releaseReference: 'REL-204', status: 'succeeded', immutable: true }); expect(closed.closures[0]).toMatchObject({ reviewChangeId: 'review-1', legalApproval: 'LEGAL-204', dispatchEvidence: 'DISPATCH-204', regulatorAcknowledgement: 'ACK-204', immutable: true }) })
  it('retains failed attempts and allows an eligible retry for the same release revision', () => { const active = rescheduleLegalReview(initialRegulatorResponseState, command); const failed = recordResponseDispatchAttempt(active, { ...dispatch, id: 'dispatch-failed', status: 'failed', failureClassification: 'gateway-timeout', retryEligible: true, dispatchEvidence: null }); const retried = recordResponseDispatchAttempt(failed, { ...dispatch, expectedRevision: 2, retryOf: 'dispatch-failed' }); expect(retried.dispatchAttempts).toMatchObject([{ status: 'failed', immutable: true }, { status: 'succeeded', retryOf: 'dispatch-failed', immutable: true }]) })
  it('explains retry eligibility and remaining attempts from durable dispatch history', () => { const active = rescheduleLegalReview(initialRegulatorResponseState, command); const failed = recordResponseDispatchAttempt(active, { ...dispatch, id: 'dispatch-failed', status: 'failed', failureClassification: 'gateway-timeout', retryEligible: true, dispatchEvidence: null }); expect(getDispatchRecoveryStatus(failed, 'REG-FCA-204', 'REL-204')).toMatchObject({ attemptsUsed: 1, attemptsRemaining: 2, canRetry: true, retryOf: 'dispatch-failed' }); const retried = recordResponseDispatchAttempt(failed, { ...dispatch, expectedRevision: 2, retryOf: 'dispatch-failed' }); expect(getDispatchRecoveryStatus(retried, 'REG-FCA-204', 'REL-204')).toMatchObject({ attemptsUsed: 2, attemptsRemaining: 1, canRetry: false, retryOf: null }) })
  it('invalidates retry when a newer approved release supersedes the failed attempt', () => { const active = rescheduleLegalReview(initialRegulatorResponseState, command); const failed = recordResponseDispatchAttempt(active, { ...dispatch, id: 'dispatch-old', status: 'failed', failureClassification: 'gateway-timeout', retryEligible: true, dispatchEvidence: null }); const newer = recordResponseDispatchAttempt(failed, { ...dispatch, id: 'dispatch-new', expectedRevision: 2, releaseReference: 'REL-204-R2', releaseRevision: 2, status: 'failed', failureClassification: 'recipient-unavailable', retryEligible: true, dispatchEvidence: null }); expect(getDispatchRecoveryStatus(newer, 'REG-FCA-204', 'REL-204')).toMatchObject({ canRetry: false, superseded: true, supersededByReleaseReference: 'REL-204-R2' }); expect(() => recordResponseDispatchAttempt(newer, { ...dispatch, id: 'retry-old', expectedRevision: 3, status: 'succeeded', retryOf: 'dispatch-old' })).toThrow('superseded') })
  it('blocks evidence gaps, follow-ups, stale, unauthorized, and duplicate closure', () => { const active = dispatched(); expect(() => closeRegulatoryObligation(active, { ...closure, dispatchEvidence: '' })).toThrow('must be complete'); expect(() => closeRegulatoryObligation(active, { ...closure, outstandingFollowUps: 1 })).toThrow('must be complete'); expect(() => closeRegulatoryObligation(active, { ...closure, expectedRevision: 0 })).toThrow('changed'); expect(() => closeRegulatoryObligation(active, { ...closure, role: 'Compliance Analyst' })).toThrow('compliance lead'); const closed = closeRegulatoryObligation(active, closure); expect(closeRegulatoryObligation(closed, closure)).toBe(closed) })
  it('queries legal, dispatch, and closure evidence chronologically', () => { const closed = closeRegulatoryObligation(dispatched(), closure); expect(queryResponseEvidenceTimeline(closed, 'REG-FCA-204').map((item) => item.kind)).toEqual(['legal-review', 'dispatch', 'closure']); expect(queryResponseEvidenceTimeline(closed, 'REG-FCA-204')[1]?.evidence).toBe('DISPATCH-204') })
})

it('keeps correction ownership with the original analyst through overdue higher-authority follow-up and alternate escalation',()=>{
  const base=structuredClone(initialRegulatorResponseState)
  base.followUpDrafts.push({id:'draft-authority',obligationId:'OBL-204-A',sourceReleaseReference:'REL-204',previousDraftId:null,requestedInformation:'Custody evidence',responseStatement:'Correction needed for dated custody.',evidenceReferences:['EVD-7'],amendmentReason:null,owner:'Regulatory liaison',draftedBy:'analyst',draftedOn:'2026-10-26',sourceRevision:0,immutable:true})
  base.correctionRequests.push({id:'correction-authority',obligationId:'OBL-204-A',returnedReviewId:'returned-authority',sourceDraftId:'draft-authority',assignedOwner:'Regulatory liaison',requestedChanges:'Correct custody dates',evidenceRequirement:'Sealed transfer',dueOn:'2026-10-28',requestedOn:'2026-10-26',immutable:true})
  const first=escalateCorrectionDeadline(base,{id:'schedule-authority',expectedRevision:0,role:'Compliance Lead',correctionRequestId:'correction-authority',owner:'Senior liaison',dueOn:'2026-11-05',acknowledgementDueOn:'2026-10-30',higherAuthority:'Senior compliance lead',reason:'Original correction deadline passed without verified custody evidence.',evidenceReference:'ESC-AUTH',escalatedBy:'lead',escalatedOn:'2026-10-29'})
  expect(correctionAssignment(first,'correction-authority')).toMatchObject({owner:'Regulatory liaison',pendingOwner:'Senior liaison'})
  const reminder={id:'reminder-authority',expectedRevision:first.revision,role:'Compliance Lead' as const,scheduleId:'schedule-authority',asOf:'2026-10-31',evidenceReference:'AUTHORITY-REMINDER',recordedBy:'lead'}
  const followed=recordCorrectionAuthorityFollowUp(first,reminder)
  expect(followed.authorityFollowUps[0]).toMatchObject({authority:'Senior compliance lead',immutable:true})
  expect(correctionAssignment(followed,'correction-authority')?.owner).toBe('Regulatory liaison')
  expect(()=>acknowledgeCorrectionEscalation(followed,{id:'late-ack',expectedRevision:followed.revision,role:'Compliance Lead',scheduleId:'schedule-authority',owner:'Senior liaison',evidenceReference:'ACK-LATE',acknowledgedBy:'Senior compliance lead',acknowledgedOn:'2026-10-31'})).toThrow('current escalation date')
  const alternate=recoverUnacknowledgedCorrectionHandoff(followed,{id:'alternate-authority',expectedRevision:followed.revision,role:'Compliance Lead',scheduleId:'schedule-authority',replacementOwner:'Duty manager',dueOn:'2026-11-10',acknowledgementDueOn:'2026-11-03',higherAuthority:'Duty compliance lead',reason:'Senior authority missed the acknowledgement deadline for correction custody.',evidenceReference:'ALTERNATE-ESC',escalatedBy:'lead',asOf:'2026-11-01'})
  expect(alternate.correctionSchedule[1]).toMatchObject({replacesUnacknowledgedId:'schedule-authority',higherAuthority:'Duty compliance lead',immutable:true})
  expect(()=>acknowledgeCorrectionEscalation(alternate,{id:'stale-authority',expectedRevision:alternate.revision,role:'Compliance Lead',scheduleId:'schedule-authority',owner:'Senior liaison',evidenceReference:'ACK-OLD',acknowledgedBy:'Senior compliance lead',acknowledgedOn:'2026-11-01'})).toThrow('current unresolved')
  const accepted=acknowledgeCorrectionEscalation(alternate,{id:'accept-authority',expectedRevision:alternate.revision,role:'Compliance Lead',scheduleId:'alternate-authority',owner:'Duty manager',evidenceReference:'ACK-ALT',acknowledgedBy:'Duty compliance lead',acknowledgedOn:'2026-11-01'})
  expect(correctionAssignment(accepted,'correction-authority')).toMatchObject({owner:'Duty manager',pendingOwner:null})
  expect(accepted.authorityFollowUps).toEqual(followed.authorityFollowUps)
  expect(new BrowserRegulatorResponsePersistence({getItem:()=>JSON.stringify({...alternate,authorityFollowUps:undefined}),setItem:()=>undefined}).load()?.authorityFollowUps).toEqual([])
})

it('pins the authority schedule to a returned correction despite later policy revisions', () => {
  const base = structuredClone(initialRegulatorResponseState)
  base.closures.push({ id: 'closure-policy', responseId: 'REG-FCA-204', reviewChangeId: 'review-policy', evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'LEGAL', complianceApproval: 'COMP', releaseReference: 'REL-204', dispatchEvidence: 'DISPATCH', regulatorAcknowledgement: 'ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20', immutable: true })
  const policy = { id: 'policy-2', expectedRevision: base.revision, role: 'Compliance Lead' as const, obligationType: 'evidence-supplement' as const, effectiveOn: '2026-10-25', primaryAuthority: 'Senior compliance lead', nextAuthority: 'Duty compliance lead', acknowledgementDays: 1, approvedBy: 'Compliance lead' }
  expect(() => reviseCorrectionAuthorityPolicy(base, { ...policy, role: 'Compliance Analyst' })).toThrow('compliance lead')
  let state = reviseCorrectionAuthorityPolicy(base, policy)
  state = recordRegulatoryFollowUp(state, { id: 'open-policy', expectedRevision: state.revision, role: 'Compliance Lead', obligationId: 'OBL-204-A', responseId: 'REG-FCA-204', releaseReference: 'REL-204', obligationType: 'evidence-supplement', deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'opened', evidenceReference: 'REQ', actor: 'lead', occurredOn: '2026-10-25' })
  state = draftRegulatoryFollowUp(state, { id: 'draft-policy', expectedRevision: state.revision, role: 'Compliance Analyst', obligationId: 'OBL-204-A', requestedInformation: 'Confirm sealed device custody', responseStatement: 'The device remained in controlled custody.', evidenceReferences: ['EVD-DEVICE-7'], amendmentReason: null, owner: 'Regulatory liaison', draftedBy: 'analyst', draftedOn: '2026-10-26' })
  state = reviewRegulatoryFollowUpDraft(state, { id: 'return-policy', expectedRevision: state.revision, role: 'Compliance Lead', obligationId: 'OBL-204-A', draftId: 'draft-policy', decision: 'returned', rationale: 'Custody dates require the sealed transfer record.', reviewer: 'lead', reviewedOn: '2026-10-26' })
  expect(state.correctionRequests[0]).toMatchObject({ authorityPolicyId: 'policy-2', immutable: true })
  const beforeRevision = state
  state = reviseCorrectionAuthorityPolicy(state, { ...policy, id: 'policy-3', expectedRevision: state.revision, primaryAuthority: 'New compliance director', nextAuthority: 'New duty director', acknowledgementDays: 2, effectiveOn: '2026-10-27' })
  const command = { id: 'schedule-policy', expectedRevision: state.revision, role: 'Compliance Lead' as const, correctionRequestId: 'return-policy:correction', owner: 'Senior liaison', dueOn: '2026-10-31', acknowledgementDueOn: '2026-10-30', higherAuthority: 'Senior compliance lead', reason: 'Correction remains incomplete after the original regulator deadline.', evidenceReference: 'ESC-POLICY', escalatedBy: 'lead', escalatedOn: '2026-10-29' }
  expect(() => escalateCorrectionDeadline(state, { ...command, higherAuthority: 'New compliance director' })).toThrow('pinned authority policy')
  expect(() => escalateCorrectionDeadline(state, { ...command, acknowledgementDueOn: '2026-10-31' })).toThrow('pinned authority policy')
  const escalated = escalateCorrectionDeadline(state, command)
  expect(escalated.correctionSchedule[0]).toMatchObject({ policyRevisionId: 'policy-2', higherAuthority: 'Senior compliance lead', acknowledgementDueOn: '2026-10-30' })
  expect(escalated.correctionRequests).toEqual(beforeRevision.correctionRequests)
  expect(escalated.authorityPolicies.map((item) => item.id)).toContain('policy-3')
  expect(new BrowserRegulatorResponsePersistence({ getItem: () => JSON.stringify({ ...beforeRevision, authorityPolicies: undefined }), setItem: () => undefined }).load()?.authorityPolicies).toHaveLength(3)
})
describe('governed follow-up execution lineage', () => {
  const event = { id: 'lineage-open', expectedRevision: 0, role: 'Compliance Lead' as const, obligationId: 'OBL-LINEAGE', responseId: 'REG-FCA-204', releaseReference: 'REL-LINEAGE', obligationType: 'evidence-supplement' as const, deadline: '2026-10-28', owner: 'Regulatory liaison', stage: 'opened' as const, evidenceReference: 'REQUEST-LINEAGE', actor: 'Compliance lead', occurredOn: '2026-10-26' }
  const draft = { id: 'lineage-draft-1', expectedRevision: 0, role: 'Compliance Analyst' as const, obligationId: event.obligationId, requestedInformation: 'Confirm the sealed evidence custody', responseStatement: 'The sealed device remained in controlled custody throughout review.', evidenceReferences: ['EVD-DEVICE-7'], amendmentReason: null as string | null, owner: event.owner, draftedBy: 'analyst', draftedOn: '2026-10-26' }
  function approved() {
    let state = rescheduleLegalReview(initialRegulatorResponseState, command)
    state = recordResponseDispatchAttempt(state, { id: 'lineage-dispatch', expectedRevision: state.revision, role: 'Compliance Lead', responseId: event.responseId, releaseReference: event.releaseReference, releaseRevision: 1, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'dispatch service', attemptedOn: '2026-10-20T19:30:00Z', retryOf: null, dispatchEvidence: 'DISPATCH-LINEAGE' })
    state = closeRegulatoryObligation(state, { id: 'lineage-close', expectedRevision: state.revision, role: 'Compliance Lead', responseId: event.responseId, evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'LEGAL', complianceApproval: 'COMP', releaseReference: event.releaseReference, dispatchEvidence: 'DISPATCH-LINEAGE', regulatorAcknowledgement: 'ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20T20:00:00Z' })
    state = recordRegulatoryFollowUp(state, { ...event, expectedRevision: state.revision })
    state = draftRegulatoryFollowUp(state, { ...draft, expectedRevision: state.revision })
    state = reviewRegulatoryFollowUpDraft(state, { id: 'lineage-review-1', expectedRevision: state.revision, role: 'Compliance Lead', obligationId: event.obligationId, draftId: draft.id, decision: 'approved', rationale: 'Custody statement and evidence reviewed.', reviewer: 'Compliance lead', reviewedOn: '2026-10-26' })
    state = recordRegulatoryFollowUp(state, { ...event, id: 'lineage-drafted', expectedRevision: state.revision, stage: 'drafted', evidenceReference: draft.id })
    return recordRegulatoryFollowUp(state, { ...event, id: 'lineage-approved', expectedRevision: state.revision, stage: 'approved', evidenceReference: draft.id })
  }
  it('pins one exact draft and review through dispatch acknowledgement and closure', () => {
    let state = approved()
    const originalApproval = structuredClone(state.followUpEvents.at(-1))
    for (const stage of ['dispatched', 'acknowledged', 'closed'] as const) state = recordRegulatoryFollowUp(state, { ...event, id: `lineage-${stage}`, expectedRevision: state.revision, stage, evidenceReference: `EVIDENCE-${stage}` })
    expect(state.followUpEvents.slice(-3)).toMatchObject([{ approvedDraftId: draft.id, approvedReviewId: 'lineage-review-1', approvalEventId: 'lineage-approved' }, { approvedDraftId: draft.id, approvedReviewId: 'lineage-review-1', approvalEventId: 'lineage-approved' }, { approvedDraftId: draft.id, approvedReviewId: 'lineage-review-1', approvalEventId: 'lineage-approved' }])
    expect(state.followUpEvents.find((item) => item.id === 'lineage-approved')).toEqual(originalApproval)
    expect(regulatoryCaseIntegrity(state, event.responseId)).toEqual([])
    expect(() => draftRegulatoryFollowUp(state, { ...draft, id: 'after-dispatch', expectedRevision: state.revision, amendmentReason: 'Cannot change a dispatched response.' })).toThrow('open regulator follow-up')
  })
  it('blocks mixed obligation identities and backdated progression without partial mutation', () => {
    const state = approved()
    const before = structuredClone(state)
    const next = { ...event, id: 'mixed-lineage', expectedRevision: state.revision, stage: 'dispatched' as const, evidenceReference: 'SEND' }
    for (const changed of [{ owner: 'Different liaison' }, { deadline: '2026-11-05' }, { obligationType: 'information-request' as const }]) expect(() => recordRegulatoryFollowUp(state, { ...next, ...changed })).toThrow('original case')
    expect(() => recordRegulatoryFollowUp(state, { ...next, occurredOn: '2026-10-25' })).toThrow('preceding stage')
    expect(state).toEqual(before)
  })
  it('renews approval after pre-dispatch correction while preserving original decisions', () => {
    const original = approved()
    let state = draftRegulatoryFollowUp(original, { ...draft, id: 'lineage-draft-2', expectedRevision: original.revision, amendmentReason: 'Corrected the sealed device custody date.', responseStatement: 'The sealed device custody date was corrected from the original register.' })
    const dispatch = { ...event, id: 'dispatch-corrected', stage: 'dispatched' as const, evidenceReference: 'CORRECTED-SEND' }
    expect(() => recordRegulatoryFollowUp(state, { ...dispatch, expectedRevision: state.revision })).toThrow('exact independently approved')
    expect(getRegulatoryFollowUpReviewReadiness(state, event.obligationId)?.blockers).toContain('Current draft needs renewed approval before dispatch')
    const approval = { ...event, id: 'renewed-approval', stage: 'approved' as const, evidenceReference: 'lineage-draft-2' }
    expect(() => recordRegulatoryFollowUp(state, { ...approval, expectedRevision: state.revision })).toThrow('approved review')
    state = reviewRegulatoryFollowUpDraft(state, { id: 'lineage-review-2', expectedRevision: state.revision, role: 'Compliance Lead', obligationId: event.obligationId, draftId: 'lineage-draft-2', decision: 'approved', rationale: 'Corrected custody source and original evidence reviewed.', reviewer: 'Compliance lead', reviewedOn: '2026-10-26' })
    state = recordRegulatoryFollowUp(state, { ...approval, expectedRevision: state.revision })
    state = recordRegulatoryFollowUp(state, { ...dispatch, expectedRevision: state.revision })
    expect(state.followUpEvents.at(-1)).toMatchObject({ approvedDraftId: 'lineage-draft-2', approvedReviewId: 'lineage-review-2', approvalEventId: 'renewed-approval' })
    expect(state.followUpEvents.filter((item) => item.stage === 'approved')).toHaveLength(2)
    expect(state.followUpReviews.slice(0, 1)).toEqual(original.followUpReviews)
    expect(regulatoryCaseIntegrity(state, event.responseId)).toEqual([])
  })
})

function acknowledgedCases() {
  let current = rescheduleLegalReview(initialRegulatorResponseState, command)
  current = recordResponseDispatchAttempt(current, { id: 'case-fca-dispatch', expectedRevision: current.revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', releaseReference: 'REL-204', releaseRevision: current.revision, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'dispatch', attemptedOn: '2026-10-20T19:30:00Z', retryOf: null, dispatchEvidence: 'FCA-DISPATCH' })
  current = closeRegulatoryObligation(current, { id: 'case-fca-close', expectedRevision: current.revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', evidenceIds: ['EVD-DEVICE-7'], legalApproval: 'FCA-LEGAL', complianceApproval: 'FCA-COMP', releaseReference: 'REL-204', dispatchEvidence: 'FCA-DISPATCH', regulatorAcknowledgement: 'FCA-ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20T20:00:00Z' })
  current = rescheduleLegalReview(current, { ...command, id: 'case-dpa-review', expectedRevision: current.revision, responseId: 'REG-DPA-118' })
  current = recordResponseDispatchAttempt(current, { id: 'case-dpa-dispatch', expectedRevision: current.revision, role: 'Compliance Lead', responseId: 'REG-DPA-118', releaseReference: 'REL-118', releaseRevision: current.revision, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'dispatch', attemptedOn: '2026-10-20T19:30:00Z', retryOf: null, dispatchEvidence: 'DPA-DISPATCH' })
  return closeRegulatoryObligation(current, { id: 'case-dpa-close', expectedRevision: current.revision, role: 'Compliance Lead', responseId: 'REG-DPA-118', evidenceIds: [], legalApproval: 'DPA-LEGAL', complianceApproval: 'DPA-COMP', releaseReference: 'REL-118', dispatchEvidence: 'DPA-DISPATCH', regulatorAcknowledgement: 'DPA-ACK', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-20T20:00:00Z' })
}
const operatorRequest = { id: 'request-open', expectedRevision: 0, role: 'Compliance Lead' as const, obligationId: 'REQUEST-204-B', responseId: 'REG-FCA-204', releaseReference: 'REL-204', requiresReviewedDraft: true as const, obligationType: 'information-request' as const, deadline: '2026-10-30', owner: 'Regulatory liaison', stage: 'opened' as const, evidenceReference: 'REGULATOR-REQUEST-204-B', actor: 'Compliance lead', occurredOn: '2026-10-26' }
it('requires independent draft approval for newly created obligations and preserves the exact source release', () => {
  const base = acknowledgedCases()
  const { requiresReviewedDraft: _flag, ...withoutExplicitPolicy } = operatorRequest; void _flag
  const guardedDefault = recordRegulatoryFollowUp(base, { ...withoutExplicitPolicy, expectedRevision: base.revision })
  expect(guardedDefault.followUpEvents[0]?.requiresReviewedDraft).toBe(true)
  let current = recordRegulatoryFollowUp(base, { ...operatorRequest, expectedRevision: base.revision })
  current = recordRegulatoryFollowUp(current, { ...operatorRequest, id: 'request-drafted', expectedRevision: current.revision, stage: 'drafted' })
  expect(() => recordRegulatoryFollowUp(current, { ...operatorRequest, id: 'unsafe-approve', expectedRevision: current.revision, stage: 'approved' })).toThrow('independently reviewed')
  expect(current.followUpDrafts).toEqual([])
  current = draftRegulatoryFollowUp(current, { id: 'request-draft', expectedRevision: current.revision, role: 'Compliance Analyst', obligationId: operatorRequest.obligationId, requestedInformation: 'Explain the operational containment sequence', responseStatement: 'The response gives reviewed evidence for the containment sequence.', evidenceReferences: ['CONTAINMENT-204'], amendmentReason: null, owner: operatorRequest.owner, draftedBy: 'analyst', draftedOn: '2026-10-26' })
  expect(() => recordRegulatoryFollowUp(current, { ...operatorRequest, id: 'unreviewed-approve', expectedRevision: current.revision, stage: 'approved', evidenceReference: 'request-draft' })).toThrow('approved review')
  current = reviewRegulatoryFollowUpDraft(current, { id: 'request-review', expectedRevision: current.revision, role: 'Compliance Lead', obligationId: operatorRequest.obligationId, draftId: 'request-draft', decision: 'approved', rationale: 'The containment evidence answers this request independently.', reviewer: 'independent lead', reviewedOn: '2026-10-26' })
  current = recordRegulatoryFollowUp(current, { ...operatorRequest, id: 'request-approval', expectedRevision: current.revision, stage: 'approved', evidenceReference: 'request-draft' })
  current = recordRegulatoryFollowUp(current, { ...operatorRequest, id: 'request-delivery', expectedRevision: current.revision, stage: 'dispatched', evidenceReference: 'REQUEST-DELIVERY-204' })
  expect(current.followUpEvents.at(-1)).toMatchObject({ requiresReviewedDraft: true, responseId: 'REG-FCA-204', releaseReference: 'REL-204', approvedDraftId: 'request-draft', approvedReviewId: 'request-review', approvalEventId: 'request-approval' })
  expect(current.closures).toEqual(base.closures)
  expect(regulatoryCaseIntegrity(current, 'REG-FCA-204')).toEqual([])
})
it('rejects invalid request dates, unacknowledged releases, roles and cross-case identifier reuse atomically', () => {
  const base = acknowledgedCases()
  const valid = { ...operatorRequest, expectedRevision: base.revision }
  for (const change of [{ deadline: '2026-02-31' }, { deadline: '2026-10-25' }, { obligationId: ' ' }, { owner: ' ' }, { role: 'Compliance Analyst' as const }, { occurredOn: '2026-10-20T19:00:00Z' }, { releaseReference: 'UNACKNOWLEDGED' }, { expectedRevision: 0 }]) expect(() => recordRegulatoryFollowUp(base, { ...valid, ...change })).toThrow()
  expect(base.followUpEvents).toEqual([])
  const opened = recordRegulatoryFollowUp(base, valid)
  expect(() => recordRegulatoryFollowUp(opened, { ...valid, id: 'wrong-case', expectedRevision: opened.revision, responseId: 'REG-DPA-118', releaseReference: 'REL-118' })).toThrow('stages')
  expect(opened.followUpEvents).toHaveLength(1)
  expect(opened.closures).toEqual(base.closures)
})
it('isolates executable case requests, preserves per-obligation drafts and scopes authority decisions', async () => {
  cleanup(); localStorage.clear()
  const base = acknowledgedCases()
  localStorage.setItem(BrowserRegulatorResponsePersistence.key, JSON.stringify(base))
  const user = userEvent.setup()
  render(createElement(RegulatorResponseControl))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Response control role' }), 'Compliance Lead')
  await user.click(screen.getByRole('button', { name: 'Advance regulator follow-up' }))
  fireEvent.change(screen.getByLabelText('Response statement'), { target: { value: 'Original FCA statement awaiting source evidence.' } })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Follow-up acknowledged case' }), 'REG-DPA-118')
  expect(screen.getByRole('button', { name: 'Advance regulator follow-up' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('New obligation ID'), { target: { value: 'REQUEST-DPA-B' } })
  fireEvent.change(screen.getByLabelText('Regulator request evidence'), { target: { value: 'DPA-REQUEST-B' } })
  await user.click(screen.getByRole('button', { name: 'Open governed regulator request' }))
  expect(screen.getByLabelText('Selected follow-up obligation')).toHaveTextContent('REL-118')
  expect(screen.getByLabelText('Evidence references')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Response statement'), { target: { value: 'Distinct DPA response preserving its own draft.' } })
  fireEvent.change(screen.getByLabelText('Evidence references'), { target: { value: 'DPA-EVIDENCE-B' } })
  fireEvent.change(screen.getByLabelText('Requested regulator information'), { target: { value: 'Provide the actual DPA request source evidence.' } })
  await user.click(screen.getByRole('button', { name: 'Save obligation draft' }))
  expect(new BrowserRegulatorResponsePersistence(localStorage).load()?.followUpDrafts.at(-1)?.draftedBy).toBe('Compliance Lead')
  await user.click(screen.getByRole('button', { name: 'Approve response draft' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cannot independently review'))
  expect(new BrowserRegulatorResponsePersistence(localStorage).load()?.followUpReviews).toEqual([])
  await user.selectOptions(screen.getByRole('combobox', { name: 'Follow-up acknowledged case' }), 'REG-FCA-204')
  expect(screen.getByLabelText('Response statement')).toHaveValue('Original FCA statement awaiting source evidence.')
  expect(screen.getByLabelText('New obligation ID')).toHaveValue('')
  expect(screen.getByLabelText('Regulator request evidence')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('New obligation ID'), { target: { value: 'UNSUBMITTED-FCA-REQUEST' } })
  fireEvent.change(screen.getByLabelText('Regulator request evidence'), { target: { value: 'FCA-UNSUBMITTED-REQUEST-EVIDENCE' } })
  expect(screen.getByRole('list', { name: 'Regulator follow-up obligations' })).not.toHaveTextContent('information-request')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Follow-up acknowledged case' }), 'REG-DPA-118')
  expect(screen.getByLabelText('Response statement')).toHaveValue('Distinct DPA response preserving its own draft.')
  expect(screen.getByLabelText('New obligation ID')).toHaveValue('REQUEST-DPA-B')
  expect(screen.getByLabelText('Regulator request evidence')).toHaveValue('DPA-REQUEST-B')
  await user.click(screen.getByRole('button', { name: 'Revise correction authority policy' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('authority policy revised'))
  const saved = new BrowserRegulatorResponsePersistence(localStorage).load()
  expect(saved?.authorityPolicies.at(-1)?.obligationType).toBe('information-request')
  expect(saved?.followUpEvents.filter((item) => item.responseId === 'REG-FCA-204')).toHaveLength(1)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Follow-up acknowledged case' }), 'REG-FCA-204')
  expect(screen.getByLabelText('New obligation ID')).toHaveValue('UNSUBMITTED-FCA-REQUEST')
  expect(screen.getByLabelText('Regulator request evidence')).toHaveValue('FCA-UNSUBMITTED-REQUEST-EVIDENCE')
  cleanup(); localStorage.clear()
})
it('safely loads malformed regulatory draft storage without changing immutable history', () => {
  for (const saved of ['null', '[]', '{"REG-FCA-204:OBL-204-A":{"draft":null}}']) {
    cleanup(); localStorage.clear(); localStorage.setItem('sentinelarc:regulatory-work-input:v1', saved); localStorage.setItem('sentinelarc:regulatory-request-input:v1', saved)
    render(createElement(RegulatorResponseControl))
    expect(screen.getByLabelText('Evidence references')).toHaveValue('EVD-DEVICE-7')
  }
  cleanup(); localStorage.clear()
})
