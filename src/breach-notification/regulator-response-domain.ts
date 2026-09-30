import { seededRegulatorResponses, type RegulatorResponseRecord } from './regulator-readiness'

export type RegulatorControlRole = 'Compliance Analyst' | 'Compliance Lead'
export interface CaseReleasePreparation { id: string; responseId: string; previousPreparationId: string | null; requiredEvidenceIds: string[]; evidenceIds: string[]; amendmentEvidence: string | null; reason: string; preparedBy: string; preparedOn: string; immutable: true }
export interface CaseLegalReleaseReview { id: string; responseId: string; preparationId: string; reviewChangeId: string; decision: 'approved' | 'returned'; rationale: string; reviewer: string; reviewedOn: string; immutable: true }
export interface LegalReviewChange { id: string; responseId: string; previousReviewer: string | null; reviewer: string; previousReviewOn: string | null; reviewOn: string; reason: string; deadline: string; immutable: true }
export interface RegulatoryClosure { id: string; responseId: string; reviewChangeId: string; evidenceIds: string[]; legalApproval: string; complianceApproval: string; releaseReference: string; dispatchEvidence: string; regulatorAcknowledgement: string; outstandingFollowUps: 0; closedBy: string; closedOn: string; immutable: true }
export interface ResponseDispatchAttempt { preparationId?: string; legalReviewId?: string; id: string; responseId: string; releaseReference: string; releaseRevision: number; attemptNumber: number; status: 'failed' | 'succeeded'; failureClassification: string | null; retryEligible: boolean; actor: string; attemptedOn: string; retryOf: string | null; dispatchEvidence: string | null; immutable: true }
export type RegulatoryFollowUpStage = 'opened' | 'drafted' | 'approved' | 'dispatched' | 'acknowledged' | 'closed'
export interface RegulatoryFollowUpEvent { id: string; obligationId: string; responseId: string; releaseReference: string; obligationType: 'information-request' | 'remediation-update' | 'evidence-supplement'; deadline: string; owner: string; stage: RegulatoryFollowUpStage; evidenceReference: string; actor: string; occurredOn: string; sourceRevision: number; requiresReviewedDraft?: true; approvedDraftId?: string; approvedReviewId?: string; approvalEventId?: string; immutable: true }
export interface FollowUpResponseDraft { id: string; obligationId: string; sourceReleaseReference: string; previousDraftId: string | null; correctionRequestId?: string; requestedInformation: string; responseStatement: string; evidenceReferences: string[]; amendmentReason: string | null; owner: string; draftedBy: string; draftedOn: string; sourceRevision: number; immutable: true }
export interface FollowUpDraftReview { id: string; obligationId: string; draftId: string; sourceReleaseReference: string; decision: 'approved' | 'returned'; rationale: string; reviewer: string; reviewedOn: string; immutable: true }
export interface CorrectionAuthorityPolicy { id: string; obligationType: RegulatoryFollowUpEvent['obligationType']; effectiveOn: string; approvedBy: string; primaryAuthority: string | null; nextAuthority: string | null; acknowledgementDays: number; immutable: true }
export interface FollowUpCorrectionRequest { id: string; obligationId: string; returnedReviewId: string; sourceDraftId: string; assignedOwner: string; requestedChanges: string; evidenceRequirement: string; dueOn: string; requestedOn: string; authorityPolicyId?: string; immutable: true }
export interface CorrectionScheduleEvent { id: string; correctionRequestId: string; previousOwner: string; owner: string; previousDueOn: string; dueOn: string; reason: string; evidenceReference: string; escalatedBy: string; escalatedOn: string; policyRevisionId?: string; replacesUnacknowledgedId?: string; acknowledgementDueOn?: string; higherAuthority?: string; immutable: true }
export interface CorrectionEscalationAcknowledgement { id: string; scheduleId: string; correctionRequestId: string; owner: string; evidenceReference: string; acknowledgedBy: string; acknowledgedOn: string; immutable: true }
export interface CorrectionAuthorityFollowUp { id: string; scheduleId: string; correctionRequestId: string; authority: string; asOf: string; evidenceReference: string; recordedBy: string; immutable: true }
export interface RegulatoryCaseArchive { casePreparations?: CaseReleasePreparation[]; caseLegalReviews?: CaseLegalReleaseReview[]; authorityPolicies?: CorrectionAuthorityPolicy[]; legacyEffectiveScheduleIds?: string[]; schemaVersion: 1; id: string; responseId: string; sourceRevision: number; createdOn: string; createdBy: string; response: RegulatorResponseRecord; reviewHistory: LegalReviewChange[]; dispatchAttempts: ResponseDispatchAttempt[]; followUpEvents: RegulatoryFollowUpEvent[]; followUpDrafts: FollowUpResponseDraft[]; followUpReviews: FollowUpDraftReview[]; correctionRequests: FollowUpCorrectionRequest[]; correctionSchedule: CorrectionScheduleEvent[]; correctionAcknowledgements: CorrectionEscalationAcknowledgement[]; authorityFollowUps: CorrectionAuthorityFollowUp[]; closures: RegulatoryClosure[]; immutable: true }
export interface RegulatorResponseState { casePreparations: CaseReleasePreparation[]; caseLegalReviews: CaseLegalReleaseReview[]; revision: number; responses: RegulatorResponseRecord[]; reviewHistory: LegalReviewChange[]; dispatchAttempts: ResponseDispatchAttempt[]; followUpEvents: RegulatoryFollowUpEvent[]; followUpDrafts: FollowUpResponseDraft[]; followUpReviews: FollowUpDraftReview[]; correctionRequests: FollowUpCorrectionRequest[]; authorityPolicies: CorrectionAuthorityPolicy[]; correctionSchedule: CorrectionScheduleEvent[]; correctionAcknowledgements: CorrectionEscalationAcknowledgement[]; authorityFollowUps: CorrectionAuthorityFollowUp[]; legacyEffectiveScheduleIds: string[]; closures: RegulatoryClosure[]; caseArchives: RegulatoryCaseArchive[] }
export const initialCorrectionAuthorityPolicies: CorrectionAuthorityPolicy[] = (['information-request', 'remediation-update', 'evidence-supplement'] as const).map((obligationType) => ({ id: `${obligationType}:policy-1`, obligationType, effectiveOn: '2026-10-20', approvedBy: 'Compliance lead', primaryAuthority: null, nextAuthority: null, acknowledgementDays: 1, immutable: true }))
export const initialRegulatorResponseState: RegulatorResponseState = { revision: 0, responses: structuredClone(seededRegulatorResponses), reviewHistory: [], dispatchAttempts: [], followUpEvents: [], followUpDrafts: [], followUpReviews: [], correctionRequests: [], authorityPolicies: structuredClone(initialCorrectionAuthorityPolicies), correctionSchedule: [], correctionAcknowledgements: [], authorityFollowUps: [], legacyEffectiveScheduleIds: [], closures: [], caseArchives: [], casePreparations: [], caseLegalReviews: [] }

export function regulatoryCaseIntegrity(state: RegulatorResponseState, responseId: string): string[] {
  const response = state.responses.find((item) => item.responseId === responseId)
  if (!response) return ['Regulatory case source record is missing.']
  const closures = state.closures.filter((item) => item.responseId === responseId)
  const attempts = state.dispatchAttempts.filter((item) => item.responseId === responseId)
  const followUps = state.followUpEvents.filter((item) => item.responseId === responseId)
  const obligationIds = new Set(followUps.map((item) => item.obligationId))
  const drafts = state.followUpDrafts.filter((item) => obligationIds.has(item.obligationId))
  const reviews = state.followUpReviews.filter((item) => obligationIds.has(item.obligationId))
  const corrections = state.correctionRequests.filter((item) => obligationIds.has(item.obligationId))
  const schedules = state.correctionSchedule.filter((item) => corrections.some((request) => request.id === item.correctionRequestId))
  const reasons: string[] = []
  if (state.caseLegalReviews.filter((item) => item.responseId === responseId).some((item) => !state.casePreparations.some((preparation) => preparation.id === item.preparationId && preparation.responseId === responseId) || !state.reviewHistory.some((review) => review.id === item.reviewChangeId && review.responseId === responseId))) reasons.push('Case legal approval lacks its source preparation or review assignment.')
  if (attempts.some((item) => item.legalReviewId && !state.caseLegalReviews.some((review) => review.id === item.legalReviewId && review.preparationId === item.preparationId && review.responseId === responseId && review.decision === 'approved'))) reasons.push('Dispatch lacks its pinned case legal approval.')
  if (closures.some((item) => !state.reviewHistory.some((review) => review.id === item.reviewChangeId && review.responseId === responseId) || !attempts.some((attempt) => attempt.status === 'succeeded' && attempt.releaseReference === item.releaseReference && attempt.dispatchEvidence === item.dispatchEvidence))) reasons.push('Acknowledged release lacks its legal review or successful dispatch source.')
  if (attempts.some((item) => item.retryOf && !attempts.some((prior) => prior.id === item.retryOf && prior.releaseRevision === item.releaseRevision))) reasons.push('Dispatch retry has no matching source release revision.')
  if (followUps.some((item) => !closures.some((closure) => closure.releaseReference === item.releaseReference))) reasons.push('Follow-up obligation lacks its acknowledged release.')
  if (drafts.some((item) => !closures.some((closure) => closure.releaseReference === item.sourceReleaseReference) || (item.previousDraftId && !drafts.some((prior) => prior.id === item.previousDraftId)))) reasons.push('Correction draft has incomplete release or prior-draft lineage.')
  if (reviews.some((item) => !drafts.some((draft) => draft.id === item.draftId))) reasons.push('Follow-up review references a missing response draft.')
  if (followUps.some((event) => event.approvedDraftId && (!drafts.some((draft) => draft.id === event.approvedDraftId && draft.obligationId === event.obligationId && draft.sourceReleaseReference === event.releaseReference) || !reviews.some((review) => review.id === event.approvedReviewId && review.draftId === event.approvedDraftId && review.decision === 'approved') || (event.approvalEventId && !followUps.some((approval) => approval.id === event.approvalEventId && approval.stage === 'approved' && approval.obligationId === event.obligationId && approval.evidenceReference === event.approvedDraftId))))) reasons.push('Follow-up execution has missing or conflicting approved draft lineage.')
  if (corrections.some((item) => !reviews.some((review) => review.id === item.returnedReviewId && review.decision === 'returned') || !drafts.some((draft) => draft.id === item.sourceDraftId))) reasons.push('Correction request lacks the returned review or source draft.')
  if (schedules.some((item) => item.replacesUnacknowledgedId && !schedules.some((prior) => prior.id === item.replacesUnacknowledgedId)) || state.correctionAcknowledgements.some((item) => schedules.some((schedule) => schedule.id === item.scheduleId) && !corrections.some((request) => request.id === item.correctionRequestId))) reasons.push('Correction reassignment or acknowledgement lineage is incomplete.')
  const pinnedPolicies = [...corrections.map((item) => item.authorityPolicyId), ...schedules.map((item) => item.policyRevisionId)].filter((id): id is string => Boolean(id))
  if (pinnedPolicies.some((id) => !state.authorityPolicies.some((policy) => policy.id === id))) reasons.push('Correction authority policy revision is missing; recover the original policy before archiving.')
  return reasons
}

export function captureRegulatoryCaseArchive(state: RegulatorResponseState, command: { id: string; expectedRevision: number; responseId: string; role: RegulatorControlRole; createdBy: string; createdOn: string }) {
  if (state.caseArchives.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulatory case changed before archive capture.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can archive a regulatory case.')
  const reasons = regulatoryCaseIntegrity(state, command.responseId)
  if (reasons.length) throw new Error(reasons.join(' '))
  const response = state.responses.find((item) => item.responseId === command.responseId)
  if (!response || !command.id.trim() || !command.createdBy.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.createdOn)) throw new Error('Case identity, archive actor, and business date are required.')
  const followUpEvents = state.followUpEvents.filter((item) => item.responseId === response.responseId)
  const obligationIds = new Set(followUpEvents.map((item) => item.obligationId))
  const followUpDrafts = state.followUpDrafts.filter((item) => obligationIds.has(item.obligationId))
  const correctionRequests = state.correctionRequests.filter((item) => obligationIds.has(item.obligationId))
  const schedules = state.correctionSchedule.filter((item) => correctionRequests.some((request) => request.id === item.correctionRequestId))
  const pinnedPolicyIds = new Set([...correctionRequests.map((item) => item.authorityPolicyId), ...schedules.map((item) => item.policyRevisionId)].filter((id): id is string => Boolean(id)))
  const authorityPolicies = state.authorityPolicies.filter((item) => pinnedPolicyIds.has(item.id))
  const legacyEffectiveScheduleIds = state.legacyEffectiveScheduleIds.filter((id) => schedules.some((item) => item.id === id))
  const archive: RegulatoryCaseArchive = structuredClone({ casePreparations: state.casePreparations.filter((item) => item.responseId === response.responseId), caseLegalReviews: state.caseLegalReviews.filter((item) => item.responseId === response.responseId), authorityPolicies, legacyEffectiveScheduleIds, schemaVersion: 1, id: command.id, responseId: response.responseId, sourceRevision: state.revision, createdOn: command.createdOn, createdBy: command.createdBy.trim(), response, reviewHistory: state.reviewHistory.filter((item) => item.responseId === response.responseId), dispatchAttempts: state.dispatchAttempts.filter((item) => item.responseId === response.responseId), followUpEvents, followUpDrafts, followUpReviews: state.followUpReviews.filter((item) => obligationIds.has(item.obligationId)), correctionRequests, correctionSchedule: schedules, correctionAcknowledgements: state.correctionAcknowledgements.filter((item) => schedules.some((schedule) => schedule.id === item.scheduleId)), authorityFollowUps: state.authorityFollowUps.filter((item) => schedules.some((schedule) => schedule.id === item.scheduleId)), closures: state.closures.filter((item) => item.responseId === response.responseId), immutable: true })
  const next = structuredClone(state)
  next.caseArchives.push(archive)
  next.revision += 1
  return next
}
function policyForCorrection(state: RegulatorResponseState, request: FollowUpCorrectionRequest) { return request.authorityPolicyId ? state.authorityPolicies.find((item) => item.id === request.authorityPolicyId) : undefined }
export function acknowledgementDeadline(asOf: string, days: number) { const date = new Date(`${asOf}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
export function reviseCorrectionAuthorityPolicy(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; obligationType: CorrectionAuthorityPolicy['obligationType']; effectiveOn: string; primaryAuthority: string | null; nextAuthority: string | null; acknowledgementDays: number; approvedBy: string }) {
  if (state.authorityPolicies.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before revising authority policy.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can revise correction authority policy.')
  const previous = state.authorityPolicies.filter((item) => item.obligationType === command.obligationType).at(-1)
  const primaryAuthority = command.primaryAuthority?.trim() ?? ''
  const nextAuthority = command.nextAuthority?.trim() ?? ''
  if (!previous || command.effectiveOn < previous.effectiveOn || !command.approvedBy.trim() || !Number.isInteger(command.acknowledgementDays) || command.acknowledgementDays < 1 || command.acknowledgementDays > 14 || (primaryAuthority && (!nextAuthority || nextAuthority === primaryAuthority)) || (!primaryAuthority && nextAuthority)) throw new Error('Authority policy needs a valid effective date, distinct escalation authorities, and a 1–14 day acknowledgement window.')
  const next = structuredClone(state)
  next.authorityPolicies.push({ id: command.id, obligationType: command.obligationType, effectiveOn: command.effectiveOn, approvedBy: command.approvedBy.trim(), primaryAuthority: primaryAuthority ? primaryAuthority : null, nextAuthority: nextAuthority ? nextAuthority : null, acknowledgementDays: command.acknowledgementDays, immutable: true })
  next.revision += 1
  return next
}
export function correctionAssignment(state: RegulatorResponseState, correctionRequestId: string) { const request = state.correctionRequests.find((item) => item.id === correctionRequestId); if (!request) return null; const change = state.correctionSchedule.filter((item) => item.correctionRequestId === request.id).at(-1); const accepted = change && (state.correctionAcknowledgements.some((item) => item.scheduleId === change.id) || state.legacyEffectiveScheduleIds.includes(change.id)); const owner = accepted ? change.owner : change?.previousOwner ?? request.assignedOwner; const dueOn = accepted ? change.dueOn : change?.previousDueOn ?? request.dueOn; return { owner, dueOn, pendingOwner: change && !accepted ? change.owner : null, pendingScheduleId: change && !accepted ? change.id : null, overdue: (asOf: string) => dueOn < asOf } }
export function escalateCorrectionDeadline(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; correctionRequestId: string; owner: string; dueOn: string; acknowledgementDueOn?: string; higherAuthority?: string; reason: string; evidenceReference: string; escalatedBy: string; escalatedOn: string }) {
  if (state.correctionSchedule.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before correction escalation.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can escalate and reassign correction work.')
  const request = state.correctionRequests.find((item) => item.id === command.correctionRequestId)
  const assignment = correctionAssignment(state, command.correctionRequestId)
  if (!request || !assignment || state.followUpDrafts.some((item) => item.correctionRequestId === request.id)) throw new Error('An unresolved active correction request is required.')
  if (assignment.pendingScheduleId) throw new Error('Pending escalation handoff must be acknowledged before another reassignment.')
  const latest = state.followUpDrafts.filter((item) => item.obligationId === request.obligationId).at(-1)
  if (latest?.id !== request.sourceDraftId) throw new Error('Correction request targets a superseded response draft.')
  const policy = policyForCorrection(state, request)
  if (request.authorityPolicyId && !policy) throw new Error('Pinned correction authority policy is unavailable.')
  if (policy?.primaryAuthority && (command.higherAuthority !== policy.primaryAuthority || command.acknowledgementDueOn !== acknowledgementDeadline(command.escalatedOn, policy.acknowledgementDays))) throw new Error('Escalation must use the pinned authority policy and acknowledgement window.')
  if (!command.owner.trim() || command.owner.trim() === assignment.owner || command.dueOn <= command.escalatedOn || command.reason.trim().length < 20 || !command.evidenceReference.trim() || !command.escalatedBy.trim()) throw new Error('A new owner, future deadline, escalation reason, and evidence are required.')
  if (command.acknowledgementDueOn && (command.acknowledgementDueOn <= command.escalatedOn || command.acknowledgementDueOn > command.dueOn || !command.higherAuthority?.trim())) throw new Error('Higher authority and an acknowledgement deadline before correction due are required.')
  const next = structuredClone(state)
  next.correctionSchedule.push({ id: command.id, correctionRequestId: request.id, previousOwner: assignment.owner, owner: command.owner.trim(), previousDueOn: assignment.dueOn, dueOn: command.dueOn, ...(policy ? { policyRevisionId: policy.id } : {}), ...(command.acknowledgementDueOn ? { acknowledgementDueOn: command.acknowledgementDueOn, higherAuthority: command.higherAuthority?.trim() ?? '' } : {}), reason: command.reason.trim(), evidenceReference: command.evidenceReference.trim(), escalatedBy: command.escalatedBy.trim(), escalatedOn: command.escalatedOn, immutable: true })
  next.revision += 1
  return next
}
export function recoverUnacknowledgedCorrectionHandoff(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; scheduleId: string; replacementOwner: string; dueOn: string; acknowledgementDueOn?: string; higherAuthority?: string; reason: string; evidenceReference: string; escalatedBy: string; asOf: string }) {
  if (state.correctionSchedule.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before recovering the unacknowledged handoff.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can recover an overdue unacknowledged handoff.')
  const schedule = state.correctionSchedule.find((item) => item.id === command.scheduleId)
  const assignment = schedule && correctionAssignment(state, schedule.correctionRequestId)
  const request = state.correctionRequests.find((item) => item.id === schedule?.correctionRequestId)
  if (!schedule || assignment?.pendingScheduleId !== schedule.id || !request || state.followUpDrafts.some((item) => item.correctionRequestId === request.id)) throw new Error('Only the current unresolved unacknowledged handoff can be recovered.')
  if (state.followUpDrafts.filter((item) => item.obligationId === request.obligationId).at(-1)?.id !== request.sourceDraftId) throw new Error('Correction request targets a superseded response draft.')
  const policy = policyForCorrection(state, request)
  if (request.authorityPolicyId && !policy) throw new Error('Pinned correction authority policy is unavailable.')
  if (policy?.nextAuthority && (command.higherAuthority !== policy.nextAuthority || command.acknowledgementDueOn !== acknowledgementDeadline(command.asOf, policy.acknowledgementDays))) throw new Error('Recovery must use the pinned next authority and acknowledgement window.')
  if (command.asOf <= (schedule.acknowledgementDueOn ?? schedule.dueOn) || command.asOf < schedule.escalatedOn || command.dueOn <= command.asOf || !command.replacementOwner.trim() || command.replacementOwner.trim() === schedule.owner || command.replacementOwner.trim() === assignment.owner || command.reason.trim().length < 20 || !command.evidenceReference.trim() || !command.escalatedBy.trim()) throw new Error('Overdue handoff requires a different owner, future deadline, reason, and evidence.')
  if (command.acknowledgementDueOn && (command.acknowledgementDueOn <= command.asOf || command.acknowledgementDueOn > command.dueOn || !command.higherAuthority?.trim() || command.higherAuthority === schedule.higherAuthority)) throw new Error('Alternate higher authority and a fresh acknowledgement deadline are required.')
  const next = structuredClone(state)
  next.correctionSchedule.push({ id: command.id, correctionRequestId: request.id, previousOwner: assignment.owner, owner: command.replacementOwner.trim(), previousDueOn: assignment.dueOn, dueOn: command.dueOn, ...(policy ? { policyRevisionId: policy.id } : {}), ...(command.acknowledgementDueOn ? { acknowledgementDueOn: command.acknowledgementDueOn, higherAuthority: command.higherAuthority?.trim() ?? '' } : {}), reason: command.reason.trim(), evidenceReference: command.evidenceReference.trim(), escalatedBy: command.escalatedBy.trim(), escalatedOn: command.asOf, replacesUnacknowledgedId: schedule.id, immutable: true })
  next.revision += 1
  return next
}
export function recordCorrectionAuthorityFollowUp(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; scheduleId: string; asOf: string; evidenceReference: string; recordedBy: string }) {
  if (state.authorityFollowUps.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before recording authority follow-up.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can record a higher-authority follow-up.')
  const schedule = state.correctionSchedule.find((item) => item.id === command.scheduleId)
  const assignment = schedule && correctionAssignment(state, schedule.correctionRequestId)
  if (!schedule?.higherAuthority || assignment?.pendingScheduleId !== schedule.id || state.followUpDrafts.some((item) => item.correctionRequestId === schedule.correctionRequestId)) throw new Error('Only the current pending higher-authority handoff can be followed up.')
  if (command.asOf < schedule.escalatedOn || !command.evidenceReference.trim() || !command.recordedBy.trim() || state.authorityFollowUps.some((item) => item.scheduleId === schedule.id && item.asOf === command.asOf)) throw new Error('Dated unique higher-authority follow-up evidence is required.')
  const next = structuredClone(state)
  next.authorityFollowUps.push({ id: command.id, scheduleId: schedule.id, correctionRequestId: schedule.correctionRequestId, authority: schedule.higherAuthority, asOf: command.asOf, evidenceReference: command.evidenceReference.trim(), recordedBy: command.recordedBy.trim(), immutable: true })
  next.revision += 1
  return next
}
export function acknowledgeCorrectionEscalation(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; scheduleId: string; owner: string; evidenceReference: string; acknowledgedBy: string; acknowledgedOn: string }) {
  if (state.correctionAcknowledgements.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before acknowledging escalation.')
  const authoritySchedule = state.correctionSchedule.find((item) => item.id === command.scheduleId)
  if (command.role !== (authoritySchedule?.higherAuthority ? 'Compliance Lead' : 'Compliance Analyst')) throw new Error('Only the designated authority can acknowledge correction ownership.')
  const schedule = state.correctionSchedule.find((item) => item.id === command.scheduleId)
  const assignment = schedule && correctionAssignment(state, schedule.correctionRequestId)
  const request = state.correctionRequests.find((item) => item.id === schedule?.correctionRequestId)
  if (!schedule || assignment?.pendingScheduleId !== schedule.id || !request || state.followUpDrafts.some((item) => item.correctionRequestId === request.id)) throw new Error('Only the current unresolved escalation can be acknowledged.')
  if (schedule.owner !== command.owner.trim() || command.acknowledgedBy.trim() !== (schedule.higherAuthority ?? schedule.owner) || !command.evidenceReference.trim() || command.acknowledgedOn < schedule.escalatedOn || command.acknowledgedOn > (schedule.acknowledgementDueOn ?? schedule.dueOn)) throw new Error('Assigned owner, receipt evidence, and current escalation date are required.')
  const next = structuredClone(state)
  next.correctionAcknowledgements.push({ id: command.id, scheduleId: schedule.id, correctionRequestId: request.id, owner: schedule.owner, evidenceReference: command.evidenceReference.trim(), acknowledgedBy: command.acknowledgedBy.trim(), acknowledgedOn: command.acknowledgedOn, immutable: true })
  next.revision += 1
  return next
}
export const dispatchRetryPolicy = { maximumAttemptsPerRelease: 3 } as const
function validCaseTimestamp(value: string) {
  const day = value.slice(0, 10)
  return /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === day
}
/** Keeps source preparation independent from legal release authority. */
export function prepareCaseRelease(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; responseId: string; evidenceIds: string[]; amendmentEvidence: string | null; reason: string; preparedBy: string; preparedOn: string; casePreparation: true }) {
  if (command.role !== 'Compliance Analyst') throw new Error('Only the compliance analyst can prepare source evidence for legal review.')
  const recorded = state.casePreparations.find((item) => item.id === command.id)
  if (recorded) {
    const evidenceIds = command.evidenceIds.map((item) => item.trim())
    const amendmentEvidence = command.amendmentEvidence?.trim() ? command.amendmentEvidence.trim() : null
    if (
    recorded.responseId !== command.responseId ||
    JSON.stringify(recorded.evidenceIds) !== JSON.stringify(evidenceIds) ||
    recorded.amendmentEvidence !== amendmentEvidence ||
    recorded.reason !== command.reason.trim() ||
    recorded.preparedBy !== command.preparedBy.trim() ||
    recorded.preparedOn !== command.preparedOn
  ) throw new Error('Preparation identity already records different intent.')
    return state
  }
  if (state.revision !== command.expectedRevision) throw new Error('Regulatory case changed. Refresh before source preparation.')
  const response = state.responses.find((item) => item.responseId === command.responseId)
  const previous = state.casePreparations.filter((item) => item.responseId === command.responseId).at(-1)
  if (!response || response.released || state.dispatchAttempts.some((item) => item.responseId === response.responseId && item.status === 'succeeded')) throw new Error('Only an undispatched open case can prepare or correct release evidence.')
  const requiredEvidenceIds = [...new Set([...response.missingEvidence, ...(previous?.requiredEvidenceIds ?? [])])]
  const evidenceIds = command.evidenceIds.map((item) => item.trim())
  const priorDecision = state.caseLegalReviews.filter((item) => item.responseId === command.responseId).at(-1)
  const priorAttempt = state.dispatchAttempts.filter((item) => item.responseId === command.responseId).at(-1)
  if (
    !command.id.trim() ||
    !command.preparedBy.trim() ||
    command.reason.trim().length < 20 ||
    !validCaseTimestamp(command.preparedOn) ||
    (previous && command.preparedOn < previous.preparedOn) ||
    (priorDecision && command.preparedOn < priorDecision.reviewedOn) ||
    (priorAttempt && command.preparedOn < priorAttempt.attemptedOn) ||
    evidenceIds.some((item) => !item) ||
    new Set(evidenceIds).size !== evidenceIds.length ||
    !requiredEvidenceIds.every((item) => evidenceIds.includes(item)) ||
    (response.amendmentRequired && !command.amendmentEvidence?.trim())
  ) throw new Error('All required evidence, amendment proof, attributable preparation, reason and valid business timestamp are required.')
  const next = structuredClone(state), target = next.responses.find((item) => item.responseId === response.responseId)
  if (!target) throw new Error('Regulatory case disappeared during preparation.')
  next.casePreparations.push({ id: command.id, responseId: response.responseId, previousPreparationId: previous?.id ?? null, requiredEvidenceIds, evidenceIds, amendmentEvidence: command.amendmentEvidence?.trim() ? command.amendmentEvidence.trim() : null, reason: command.reason.trim(), preparedBy: command.preparedBy.trim(), preparedOn: command.preparedOn, immutable: true })
  target.draftComplete = true; target.missingEvidence = []; target.amendmentCompleted = target.amendmentRequired
  next.revision += 1
  return next
}
export function reviewCaseRelease(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; responseId: string; preparationId: string; decision: CaseLegalReleaseReview['decision']; rationale: string; reviewer: string; reviewedOn: string; caseLegalReview: true }) {
  if (command.role !== 'Compliance Lead') throw new Error('Only the authorized legal review lead can decide release evidence.')
  if (!command.id.trim()) throw new Error('Legal review needs an attributable command identity.')
  const recorded = state.caseLegalReviews.find((item) => item.id === command.id)
  if (recorded) {
    if (recorded.responseId !== command.responseId || recorded.preparationId !== command.preparationId || recorded.decision !== command.decision || recorded.rationale !== command.rationale.trim() || recorded.reviewer !== command.reviewer.trim() || recorded.reviewedOn !== command.reviewedOn) throw new Error('Legal review identity already records different intent.')
    return state
  }
  if (state.revision !== command.expectedRevision) throw new Error('Regulatory case changed. Refresh before legal release review.')
  const response = state.responses.find((item) => item.responseId === command.responseId)
  const preparation = state.casePreparations.filter((item) => item.responseId === command.responseId).at(-1)
  const schedule = state.reviewHistory.filter((item) => item.responseId === command.responseId).at(-1)
  if (!response || response.released || preparation?.id !== command.preparationId || !schedule || state.caseLegalReviews.some((item) => item.preparationId === preparation.id && item.reviewChangeId === schedule.id)) throw new Error('Current unreviewed source preparation and an assigned legal review are required.')
  if (
    !command.reviewer.trim() ||
    command.reviewer.trim() !== schedule.reviewer ||
    command.reviewer.trim() === preparation.preparedBy ||
    command.rationale.trim().length < 20 ||
    !validCaseTimestamp(command.reviewedOn) ||
    command.reviewedOn < preparation.preparedOn ||
    command.reviewedOn < schedule.reviewOn
  ) throw new Error('Independent assigned legal reviewer, substantive rationale and review after preparation and schedule are required.')
  const next = structuredClone(state)
  next.caseLegalReviews.push({ id: command.id, responseId: response.responseId, preparationId: preparation.id, reviewChangeId: schedule.id, decision: command.decision, rationale: command.rationale.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, immutable: true })
  if (command.decision === 'returned') { const target = next.responses.find((item) => item.responseId === response.responseId); if (target) target.draftComplete = false }
  next.revision += 1
  return next
}
function currentCaseApproval(state: RegulatorResponseState, responseId: string) {
  const response = state.responses.find((item) => item.responseId === responseId)
  const preparation = state.casePreparations.filter((item) => item.responseId === responseId).at(-1)
  const schedule = state.reviewHistory.filter((item) => item.responseId === responseId).at(-1)
  const review = state.caseLegalReviews.filter((item) => item.responseId === responseId).at(-1)
  if (
    !response ||
    !preparation ||
    !schedule ||
    review?.decision !== 'approved' ||
    review.preparationId !== preparation.id ||
    review.reviewChangeId !== schedule.id ||
    review.reviewer !== schedule.reviewer ||
    review.reviewer === preparation.preparedBy ||
    !response.draftComplete ||
    response.missingEvidence.length ||
    (response.amendmentRequired && !response.amendmentCompleted)
  ) throw new Error('Current case evidence requires independent legal approval before dispatch or closure.')
  return { preparation, review }
}

interface RescheduleLegalReview { id: string; expectedRevision: number; role: RegulatorControlRole; responseId: string; reviewer: string; reviewOn: string; asOf: string; reason: string }

export function rescheduleLegalReview(state: RegulatorResponseState, command: RescheduleLegalReview) {
  if (state.reviewHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before rescheduling legal review.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can reassign legal review.')
  const response = state.responses.find((item) => item.responseId === command.responseId)
  if (!response) throw new Error('Regulator response was not found.')
  if (response.released) throw new Error('A released regulator response is immutable.')
  if (!(command.asOf < command.reviewOn && command.reviewOn < response.deadline)) throw new Error('Legal review must occur after today and before the response deadline.')
  if (command.reason.trim().length < 20) throw new Error('Review reassignment reason is required.')
  const next = structuredClone(state)
  const target = next.responses.find((item) => item.responseId === response.responseId)
  if (!target) throw new Error('Regulator response disappeared during review scheduling.')
  next.reviewHistory.push({ id: command.id, responseId: response.responseId, previousReviewer: response.reviewer, reviewer: command.reviewer, previousReviewOn: response.reviewOn, reviewOn: command.reviewOn, reason: command.reason.trim(), deadline: response.deadline, immutable: true })
  target.reviewer = command.reviewer
  target.reviewOn = command.reviewOn
  next.revision += 1
  return next
}

interface RecordResponseDispatch { id: string; expectedRevision: number; role: RegulatorControlRole; responseId: string; releaseReference: string; releaseRevision: number; status: 'failed' | 'succeeded'; failureClassification: string | null; retryEligible: boolean; actor: string; attemptedOn: string; retryOf: string | null; dispatchEvidence: string | null }
export function recordResponseDispatchAttempt(state: RegulatorResponseState, command: RecordResponseDispatch) {
  if (state.dispatchAttempts.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before dispatching the approved release.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can dispatch an approved regulator response.')
  const response = state.responses.find((item) => item.responseId === command.responseId)
  const review = [...state.reviewHistory].reverse().find((item) => item.responseId === command.responseId)
  if (!response || !review || response.released) throw new Error('A reviewed unreleased response is required before dispatch.')
  const approval = response.responseId !== 'REG-FCA-204' || state.casePreparations.some((item) => item.responseId === response.responseId) ? currentCaseApproval(state, response.responseId) : null
  if (approval && (!command.releaseReference.trim() || !command.actor.trim() || (command.status === 'succeeded' && !command.dispatchEvidence?.trim()) || (command.status === 'failed' && !command.failureClassification?.trim()) || state.dispatchAttempts.some((item) => item.responseId !== response.responseId && item.releaseReference === command.releaseReference) || !validCaseTimestamp(command.attemptedOn) || command.attemptedOn < approval.review.reviewedOn)) throw new Error('Dispatch cannot predate its current independent legal approval.')
  const releaseAttempts = state.dispatchAttempts.filter((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference)
  if (approval && releaseAttempts.some((item) => item.preparationId !== approval.preparation.id || item.legalReviewId !== approval.review.id)) throw new Error('Changed case approval needs a distinct release reference; previous attempts stay immutable.')
  if (releaseAttempts.length === 0 && command.releaseRevision !== state.revision) throw new Error('Dispatch targets a stale approved release revision.')
  const attempts = state.dispatchAttempts.filter((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference && item.releaseRevision === command.releaseRevision)
  if (attempts.some((item) => item.status === 'succeeded')) throw new Error('This approved release was already dispatched successfully.')
  if (attempts.length >= dispatchRetryPolicy.maximumAttemptsPerRelease) throw new Error('Dispatch retry limit reached for this release revision.')
  if (command.retryOf) { const previous = releaseAttempts.find((item) => item.id === command.retryOf); if (previous?.status !== 'failed' || !previous.retryEligible || previous.releaseRevision !== command.releaseRevision) throw new Error('Dispatch retry must reference an eligible failed attempt for this release revision.'); if (state.dispatchAttempts.some((item) => item.responseId === command.responseId && item.releaseRevision > previous.releaseRevision)) throw new Error('A newer approved release superseded this failed dispatch attempt.') }
  if (command.status === 'failed' ? !command.failureClassification : !command.dispatchEvidence) throw new Error('Dispatch result evidence is incomplete.')
  const next = structuredClone(state)
  next.dispatchAttempts.push({ ...command, ...(approval ? { preparationId: approval.preparation.id, legalReviewId: approval.review.id } : {}), attemptNumber: attempts.length + 1, immutable: true })
  next.revision += 1
  return next
}

interface CloseRegulatoryObligation { id: string; expectedRevision: number; role: RegulatorControlRole; responseId: string; evidenceIds: string[]; legalApproval: string; complianceApproval: string; releaseReference: string; dispatchEvidence: string; regulatorAcknowledgement: string; outstandingFollowUps: number; closedBy: string; closedOn: string }
export function closeRegulatoryObligation(state: RegulatorResponseState, command: CloseRegulatoryObligation) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before closure.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can independently close a regulatory obligation.')
  const response = state.responses.find((item) => item.responseId === command.responseId)
  const review = [...state.reviewHistory].reverse().find((item) => item.responseId === command.responseId)
  if (!response || !review || response.released) throw new Error('A reviewed unreleased response is required.')
  if (command.evidenceIds.length < response.missingEvidence.length || !command.legalApproval || !command.complianceApproval) throw new Error('Evidence plus independent legal and compliance approvals are required.')
  if (!command.releaseReference || !command.dispatchEvidence || !command.regulatorAcknowledgement || command.outstandingFollowUps !== 0) throw new Error('Release, dispatch, acknowledgement, and follow-up evidence must be complete.')
  const dispatch = [...state.dispatchAttempts].reverse().find((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference && item.status === 'succeeded' && item.dispatchEvidence === command.dispatchEvidence)
  if (!dispatch) throw new Error('A successful durable dispatch attempt is required before acknowledgement and closure.')
  const approval = response.responseId !== 'REG-FCA-204' || state.casePreparations.some((item) => item.responseId === response.responseId) ? currentCaseApproval(state, response.responseId) : null
  if (approval && (!command.closedBy.trim() || !command.regulatorAcknowledgement.trim() || command.legalApproval !== approval.review.id || command.complianceApproval !== command.id || command.closedBy.trim() === approval.review.reviewer || dispatch.preparationId !== approval.preparation.id || dispatch.legalReviewId !== approval.review.id || !approval.preparation.evidenceIds.every((item) => command.evidenceIds.includes(item)) || !validCaseTimestamp(command.closedOn) || command.closedOn < dispatch.attemptedOn)) throw new Error('Closure must pin the dispatched source preparation, legal review and independent compliance acknowledgement.')
  const next = structuredClone(state)
  const target = next.responses.find((item) => item.responseId === response.responseId)
  if (!target) throw new Error('Regulator response disappeared during closure.')
  next.closures.push({ ...command, outstandingFollowUps: 0, reviewChangeId: review.id, evidenceIds: [...command.evidenceIds], immutable: true })
  target.missingEvidence = []
  target.amendmentCompleted = target.amendmentRequired
  target.released = true
  next.revision += 1
  return next
}

interface RecordRegulatoryFollowUp { requiresReviewedDraft?: true; id: string; expectedRevision: number; role: RegulatorControlRole; obligationId: string; responseId: string; releaseReference: string; obligationType: RegulatoryFollowUpEvent['obligationType']; deadline: string; owner: string; stage: RegulatoryFollowUpStage; evidenceReference: string; actor: string; occurredOn: string }
export function recordRegulatoryFollowUp(state: RegulatorResponseState, command: RecordRegulatoryFollowUp) {
  if (state.followUpEvents.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before recording follow-up work.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can control regulator follow-up obligations.')
  const closure = state.closures.find((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference)
  if (!closure) throw new Error('Follow-up must reference the acknowledged immutable regulator release.')
  if (command.stage === 'opened') {
    const validDeadline = /^20\d{2}-\d{2}-\d{2}$/.test(command.deadline) && Number.isFinite(Date.parse(command.deadline)) && new Date(command.deadline).toISOString().slice(0, 10) === command.deadline
    if (!command.obligationId.trim() || command.obligationId !== command.obligationId.trim() || !command.owner.trim() || !command.actor.trim() || !Number.isFinite(Date.parse(command.occurredOn)) || !validDeadline || command.deadline < command.occurredOn.slice(0, 10) || Date.parse(command.occurredOn) < Date.parse(closure.closedOn)) throw new Error('Opening an obligation requires a durable identity, named owner and actor, and a valid deadline after the acknowledged release.')
  }
  const history = state.followUpEvents.filter((item) => item.obligationId === command.obligationId)
  const order: RegulatoryFollowUpStage[] = ['opened', 'drafted', 'approved', 'dispatched', 'acknowledged', 'closed']
  const newGovernedRequest = command.stage === 'opened' && (command.responseId !== 'REG-FCA-204' || command.obligationId !== 'OBL-204-A')
  const previous = history.at(-1)
  const latestDraft = state.followUpDrafts.filter((item) => item.obligationId === command.obligationId).at(-1)
  const renewsApproval = previous?.stage === 'approved' && command.stage === 'approved' && latestDraft !== undefined && latestDraft.id !== previous.evidenceReference && command.evidenceReference === latestDraft.id
  if ((history.length === 0 && command.stage !== 'opened') || (previous && !renewsApproval && order.indexOf(command.stage) !== order.indexOf(previous.stage) + 1)) throw new Error('Regulator follow-up stages must preserve approval, dispatch, acknowledgement, and closure order.')
  const original = history[0]
  if ((original?.requiresReviewedDraft || command.requiresReviewedDraft || newGovernedRequest) && ['approved', 'dispatched', 'acknowledged', 'closed'].includes(command.stage) && !latestDraft) throw new Error('Operator-created obligations require an independently reviewed response draft before approval or execution.')
  if (original && (original.responseId !== command.responseId || original.releaseReference !== command.releaseReference || original.obligationType !== command.obligationType || original.owner !== command.owner || original.deadline !== command.deadline)) throw new Error('Follow-up progression must preserve its original case, release, obligation type, owner and deadline.')
  if (previous && command.occurredOn < previous.occurredOn) throw new Error('Follow-up evidence cannot predate its preceding stage.')
  if (!command.deadline || !command.owner || !command.evidenceReference.trim()) throw new Error('Follow-up deadline, owner, and stage evidence are required.')
  if (command.stage === 'approved' && latestDraft) {
    if (command.evidenceReference !== latestDraft.id) throw new Error('Legal approval must reference the latest obligation-specific draft.')
    if (state.followUpReviews.filter((item) => item.draftId === latestDraft.id).at(-1)?.decision !== 'approved') throw new Error('Latest follow-up draft requires an approved review before release.')
  }
  const approval = history.filter((item) => item.stage === 'approved').at(-1)
  const approvedReview = latestDraft ? state.followUpReviews.find((item) => item.draftId === latestDraft.id && item.decision === 'approved') : undefined
  if (latestDraft && ['dispatched', 'acknowledged', 'closed'].includes(command.stage) && (approval?.evidenceReference !== latestDraft.id || !approvedReview || (approval.approvedReviewId && approval.approvedReviewId !== approvedReview.id))) throw new Error('Follow-up execution requires the exact independently approved draft and review lineage.')
  const pins = latestDraft && approvedReview && (command.stage === 'approved' || ['dispatched', 'acknowledged', 'closed'].includes(command.stage)) ? { approvedDraftId: latestDraft.id, approvedReviewId: approvedReview.id, ...(approval && command.stage !== 'approved' ? { approvalEventId: approval.id } : {}) } : {}
  const next = structuredClone(state)
  next.followUpEvents.push({ ...command, ...(original?.requiresReviewedDraft || newGovernedRequest ? { requiresReviewedDraft: true as const } : {}), ...pins, evidenceReference: command.evidenceReference.trim(), sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function draftRegulatoryFollowUp(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; obligationId: string; requestedInformation: string; responseStatement: string; evidenceReferences: string[]; amendmentReason: string | null; owner: string; draftedBy: string; draftedOn: string }) {
  if (state.followUpDrafts.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before drafting the follow-up.')
  if (!(new Set<string>(['Compliance Analyst', 'Compliance Lead'])).has(command.role)) throw new Error('Only compliance staff can draft regulator follow-up responses.')
  const history = state.followUpEvents.filter((item) => item.obligationId === command.obligationId)
  const obligation = history.at(-1)
  if (!obligation || !['opened', 'drafted', 'approved'].includes(obligation.stage)) throw new Error('An open regulator follow-up obligation is required for drafting.')
  const previous = state.followUpDrafts.filter((item) => item.obligationId === command.obligationId).at(-1) ?? null
  if (command.requestedInformation.trim().length < 10 || command.responseStatement.trim().length < 20 || command.evidenceReferences.length === 0 || !command.owner.trim() || (previous && (command.amendmentReason?.trim().length ?? 0) < 15)) throw new Error('Response statement, requested information, evidence, owner, and amendment reason are required.')
  const returned = state.followUpReviews.find((item) => item.draftId === previous?.id && item.decision === 'returned')
  const correction = state.correctionRequests.find((item) => item.returnedReviewId === returned?.id)
  if (returned && !correction) throw new Error('Returned review needs an assigned correction request.')
  const assignment = correction ? correctionAssignment(state, correction.id) : null
  if (correction && (assignment?.owner !== command.owner.trim() || command.draftedOn > assignment.dueOn || (previous?.responseStatement === command.responseStatement.trim() && previous.evidenceReferences.join('|') === command.evidenceReferences.join('|')))) throw new Error('Assigned correction must change the returned draft before its due date.')
  const next = structuredClone(state)
  next.followUpDrafts.push({ id: command.id, obligationId: command.obligationId, sourceReleaseReference: obligation.releaseReference, previousDraftId: previous?.id ?? null, ...(correction ? { correctionRequestId: correction.id } : {}), requestedInformation: command.requestedInformation.trim(), responseStatement: command.responseStatement.trim(), evidenceReferences: [...command.evidenceReferences], amendmentReason: command.amendmentReason?.trim() ?? null, owner: command.owner.trim(), draftedBy: command.draftedBy, draftedOn: command.draftedOn, sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function reviewRegulatoryFollowUpDraft(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; obligationId: string; draftId: string; decision: FollowUpDraftReview['decision']; rationale: string; reviewer: string; reviewedOn: string }) {
  if (state.followUpReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before reviewing the follow-up draft.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can review a regulator follow-up draft.')
  const latest = state.followUpDrafts.filter((item) => item.obligationId === command.obligationId).at(-1)
  const stage = state.followUpEvents.filter((item) => item.obligationId === command.obligationId).at(-1)?.stage
  if (!latest) throw new Error('Review must target the latest open obligation draft.')
  if (latest.id !== command.draftId || (stage !== 'opened' && stage !== 'drafted' && stage !== 'approved')) throw new Error('Review must target the latest open obligation draft.')
  const approvedStage = state.followUpEvents.filter((item) => item.obligationId === command.obligationId && item.stage === 'approved').at(-1)
  if (stage === 'approved' && approvedStage?.evidenceReference === latest.id) throw new Error('An already released draft must be amended before independent reapproval.')
  if (!command.reviewer.trim() || command.rationale.trim().length < 15) throw new Error('Reviewer and decision rationale are required.')
  if (latest.draftedBy.trim().toLowerCase() === command.reviewer.trim().toLowerCase()) throw new Error('Draft author cannot independently review the same response.')
  if (state.followUpReviews.some((item) => item.draftId === latest.id)) throw new Error('This draft already has a review decision. Prepare an amended draft.')
  const next = structuredClone(state)
  next.followUpReviews.push({ id: command.id, obligationId: command.obligationId, draftId: latest.id, sourceReleaseReference: latest.sourceReleaseReference, decision: command.decision, rationale: command.rationale.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, immutable: true })
  if (command.decision === 'returned') { const obligation = state.followUpEvents.filter((item) => item.obligationId === command.obligationId).at(-1); if (!obligation || command.reviewedOn > obligation.deadline) throw new Error('Correction assignment requires a current obligation deadline.'); const policy = state.authorityPolicies.filter((item) => item.obligationType === obligation.obligationType && item.effectiveOn <= command.reviewedOn).at(-1); next.correctionRequests.push({ id: `${command.id}:correction`, obligationId: command.obligationId, returnedReviewId: command.id, sourceDraftId: latest.id, assignedOwner: latest.owner, requestedChanges: command.rationale.trim(), evidenceRequirement: latest.requestedInformation, dueOn: obligation.deadline, requestedOn: command.reviewedOn, ...(policy ? { authorityPolicyId: policy.id } : {}), immutable: true }) }
  next.revision += 1
  return next
}

export function compareRegulatorFollowUpDrafts(state: RegulatorResponseState, obligationId: string) { const drafts = state.followUpDrafts.filter((item) => item.obligationId === obligationId); const current = drafts.at(-1); if (!current) return null; const previous = drafts.find((item) => item.id === current.previousDraftId) ?? null; return { previous, current, changedStatement: previous ? previous.responseStatement !== current.responseStatement : null, addedEvidence: current.evidenceReferences.filter((item) => !previous?.evidenceReferences.includes(item)), removedEvidence: previous?.evidenceReferences.filter((item) => !current.evidenceReferences.includes(item)) ?? [], amendmentReason: current.amendmentReason } }

export function getRegulatoryFollowUpReviewReadiness(state: RegulatorResponseState, obligationId: string) {
  const draft = state.followUpDrafts.filter((item) => item.obligationId === obligationId).at(-1)
  if (!draft) return null
  const obligation = state.followUpEvents.filter((item) => item.obligationId === obligationId).at(-1) ?? null
  const sourceRelease = state.closures.find((item) => item.releaseReference === draft.sourceReleaseReference && item.responseId === obligation?.responseId) ?? null
  const review = state.followUpReviews.find((item) => item.draftId === draft.id) ?? null
  const latestApproval = state.followUpEvents.filter((item) => item.obligationId === obligationId && item.stage === 'approved').at(-1)
  const blockers = [...(!sourceRelease ? ['Acknowledged source release unavailable'] : []), ...(draft.evidenceReferences.length === 0 ? ['Selected evidence missing'] : []), ...(review?.decision === 'returned' ? ['Current draft returned for correction'] : !review ? ['Current draft requires independent review'] : []), ...(obligation?.stage !== 'approved' && obligation?.stage !== 'dispatched' && obligation?.stage !== 'acknowledged' && obligation?.stage !== 'closed' ? ['Follow-up approval stage pending'] : [])]
  if (latestApproval && latestApproval.evidenceReference !== draft.id) blockers.push('Current draft needs renewed approval before dispatch')
  const dispatchReady = blockers.length === 0 && obligation?.stage === 'approved'
  const dispatchStatus = obligation?.stage === 'dispatched' || obligation?.stage === 'acknowledged' || obligation?.stage === 'closed' ? `follow-up ${obligation.stage}` : dispatchReady ? 'approved for dispatch' : blockers.join('; ')
  return { draft, obligation, sourceRelease, review, blockers, dispatchReady, dispatchStatus }
}

export function getRegulatoryFollowUpObligations(state: RegulatorResponseState, asOf: string) {
  const ids = [...new Set(state.followUpEvents.map((item) => item.obligationId))]
  return ids.map((obligationId) => {
    const history = state.followUpEvents.filter((item) => item.obligationId === obligationId)
    const latest = history.at(-1)
    if (!latest) throw new Error('Regulator follow-up history disappeared during read.')
    return { obligationId, responseId: latest.responseId, releaseReference: latest.releaseReference, obligationType: latest.obligationType, deadline: latest.deadline, owner: latest.owner, status: latest.stage, overdue: latest.stage !== 'closed' && latest.deadline < asOf, history }
  })
}

export function queryResponseEvidenceTimeline(state: RegulatorResponseState, responseId: string) {
  return [
    ...state.reviewHistory.filter((item) => item.responseId === responseId).map((item) => ({ kind: 'legal-review' as const, occurredOn: item.reviewOn, evidence: item.reason })),
    ...state.dispatchAttempts.filter((item) => item.responseId === responseId).map((item) => ({ kind: 'dispatch' as const, occurredOn: item.attemptedOn, evidence: item.dispatchEvidence ?? item.failureClassification ?? 'dispatch failed' })),
    ...state.closures.filter((item) => item.responseId === responseId).map((item) => ({ kind: 'closure' as const, occurredOn: item.closedOn, evidence: item.regulatorAcknowledgement })),
  ].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
}

export function getDispatchRecoveryStatus(state: RegulatorResponseState, responseId: string, releaseReference: string) {
  const attempts = state.dispatchAttempts.filter((item) => item.responseId === responseId && item.releaseReference === releaseReference)
  const latest = attempts.at(-1) ?? null
  const succeeded = attempts.some((item) => item.status === 'succeeded')
  const supersedingAttempt = latest ? state.dispatchAttempts.find((item) => item.responseId === responseId && item.releaseReference !== releaseReference && item.releaseRevision > latest.releaseRevision) ?? null : null
  return {
    attempts,
    latest,
    attemptsUsed: attempts.length,
    attemptsRemaining: Math.max(0, dispatchRetryPolicy.maximumAttemptsPerRelease - attempts.length),
    canRetry: !succeeded && !supersedingAttempt && latest?.status === 'failed' && latest.retryEligible && attempts.length < dispatchRetryPolicy.maximumAttemptsPerRelease,
    retryOf: !succeeded && latest?.status === 'failed' ? latest.id : null,
    superseded: Boolean(supersedingAttempt),
    supersededByReleaseReference: supersedingAttempt?.releaseReference ?? null,
  }
}

export interface RegulatorResponsePersistence { load(): RegulatorResponseState | null; save(state: RegulatorResponseState): void }
export class BrowserRegulatorResponsePersistence implements RegulatorResponsePersistence {
  static key = 'sentinelarc:regulator-response-control:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserRegulatorResponsePersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<RegulatorResponseState>; return { ...(saved as RegulatorResponseState), reviewHistory: saved.reviewHistory ?? [], dispatchAttempts: saved.dispatchAttempts ?? [], followUpEvents: saved.followUpEvents ?? [], followUpDrafts: saved.followUpDrafts ?? [], followUpReviews: saved.followUpReviews ?? [], correctionRequests: saved.correctionRequests ?? [], authorityPolicies: saved.authorityPolicies ?? structuredClone(initialCorrectionAuthorityPolicies), correctionSchedule: saved.correctionSchedule ?? [], correctionAcknowledgements: saved.correctionAcknowledgements ?? [], authorityFollowUps: saved.authorityFollowUps ?? [], legacyEffectiveScheduleIds: saved.legacyEffectiveScheduleIds ?? (saved.correctionAcknowledgements === undefined ? (saved.correctionSchedule ?? []).map((item) => item.id) : []), closures: saved.closures ?? [], caseArchives: saved.caseArchives ?? [], casePreparations: saved.casePreparations ?? [], caseLegalReviews: saved.caseLegalReviews ?? [] } }
  save(state: RegulatorResponseState) { this.storage.setItem(BrowserRegulatorResponsePersistence.key, JSON.stringify(state)) }
}
export class RegulatorResponseRepository {
  private readonly persistence: RegulatorResponsePersistence
  constructor(persistence: RegulatorResponsePersistence | Pick<Storage, 'getItem' | 'setItem'>) { this.persistence = 'load' in persistence ? persistence : new BrowserRegulatorResponsePersistence(persistence) }
  read(): RegulatorResponseState { return this.persistence.load() ?? structuredClone(initialRegulatorResponseState) }
  dispatch(command: Parameters<typeof prepareCaseRelease>[1] | Parameters<typeof reviewCaseRelease>[1] | RescheduleLegalReview | RecordResponseDispatch | CloseRegulatoryObligation | RecordRegulatoryFollowUp | Parameters<typeof draftRegulatoryFollowUp>[1] | Parameters<typeof reviewRegulatoryFollowUpDraft>[1] | Parameters<typeof escalateCorrectionDeadline>[1] | Parameters<typeof acknowledgeCorrectionEscalation>[1] | Parameters<typeof recoverUnacknowledgedCorrectionHandoff>[1] | Parameters<typeof recordCorrectionAuthorityFollowUp>[1] | Parameters<typeof reviseCorrectionAuthorityPolicy>[1]) { const current = this.read(); const next = 'casePreparation' in command ? prepareCaseRelease(current, command) : 'caseLegalReview' in command ? reviewCaseRelease(current, command) : 'primaryAuthority' in command ? reviseCorrectionAuthorityPolicy(current, command) : 'asOf' in command && 'scheduleId' in command && 'recordedBy' in command ? recordCorrectionAuthorityFollowUp(current, command) : 'replacementOwner' in command ? recoverUnacknowledgedCorrectionHandoff(current, command) : 'scheduleId' in command ? acknowledgeCorrectionEscalation(current, command) : 'correctionRequestId' in command ? escalateCorrectionDeadline(current, command) : 'decision' in command ? reviewRegulatoryFollowUpDraft(current, command) : 'responseStatement' in command ? draftRegulatoryFollowUp(current, command) : 'obligationId' in command ? recordRegulatoryFollowUp(current, command) : 'regulatorAcknowledgement' in command ? closeRegulatoryObligation(current, command) : 'releaseRevision' in command ? recordResponseDispatchAttempt(current, command) : rescheduleLegalReview(current, command); if (next !== current) this.persistence.save(next); return next }
  captureArchive(command: Parameters<typeof captureRegulatoryCaseArchive>[1]) { const current = this.read(); const next = captureRegulatoryCaseArchive(current, command); if (next !== current) this.persistence.save(next); return next }
}
