import { seededRegulatorResponses, type RegulatorResponseRecord } from './regulator-readiness'

export type RegulatorControlRole = 'Compliance Analyst' | 'Compliance Lead'
export interface LegalReviewChange { id: string; responseId: string; previousReviewer: string | null; reviewer: string; previousReviewOn: string | null; reviewOn: string; reason: string; deadline: string; immutable: true }
export interface RegulatoryClosure { id: string; responseId: string; reviewChangeId: string; evidenceIds: string[]; legalApproval: string; complianceApproval: string; releaseReference: string; dispatchEvidence: string; regulatorAcknowledgement: string; outstandingFollowUps: 0; closedBy: string; closedOn: string; immutable: true }
export interface ResponseDispatchAttempt { id: string; responseId: string; releaseReference: string; releaseRevision: number; attemptNumber: number; status: 'failed' | 'succeeded'; failureClassification: string | null; retryEligible: boolean; actor: string; attemptedOn: string; retryOf: string | null; dispatchEvidence: string | null; immutable: true }
export type RegulatoryFollowUpStage = 'opened' | 'drafted' | 'approved' | 'dispatched' | 'acknowledged' | 'closed'
export interface RegulatoryFollowUpEvent { id: string; obligationId: string; responseId: string; releaseReference: string; obligationType: 'information-request' | 'remediation-update' | 'evidence-supplement'; deadline: string; owner: string; stage: RegulatoryFollowUpStage; evidenceReference: string; actor: string; occurredOn: string; sourceRevision: number; immutable: true }
export interface FollowUpResponseDraft { id: string; obligationId: string; sourceReleaseReference: string; previousDraftId: string | null; correctionRequestId?: string; requestedInformation: string; responseStatement: string; evidenceReferences: string[]; amendmentReason: string | null; owner: string; draftedBy: string; draftedOn: string; sourceRevision: number; immutable: true }
export interface FollowUpDraftReview { id: string; obligationId: string; draftId: string; sourceReleaseReference: string; decision: 'approved' | 'returned'; rationale: string; reviewer: string; reviewedOn: string; immutable: true }
export interface FollowUpCorrectionRequest { id: string; obligationId: string; returnedReviewId: string; sourceDraftId: string; assignedOwner: string; requestedChanges: string; evidenceRequirement: string; dueOn: string; requestedOn: string; immutable: true }
export interface CorrectionScheduleEvent { id: string; correctionRequestId: string; previousOwner: string; owner: string; previousDueOn: string; dueOn: string; reason: string; evidenceReference: string; escalatedBy: string; escalatedOn: string; immutable: true }
export interface RegulatorResponseState { revision: number; responses: RegulatorResponseRecord[]; reviewHistory: LegalReviewChange[]; dispatchAttempts: ResponseDispatchAttempt[]; followUpEvents: RegulatoryFollowUpEvent[]; followUpDrafts: FollowUpResponseDraft[]; followUpReviews: FollowUpDraftReview[]; correctionRequests: FollowUpCorrectionRequest[]; correctionSchedule: CorrectionScheduleEvent[]; closures: RegulatoryClosure[] }
export const initialRegulatorResponseState: RegulatorResponseState = { revision: 0, responses: structuredClone(seededRegulatorResponses), reviewHistory: [], dispatchAttempts: [], followUpEvents: [], followUpDrafts: [], followUpReviews: [], correctionRequests: [], correctionSchedule: [], closures: [] }
export function correctionAssignment(state: RegulatorResponseState, correctionRequestId: string) { const request = state.correctionRequests.find((item) => item.id === correctionRequestId); if (!request) return null; const change = state.correctionSchedule.filter((item) => item.correctionRequestId === request.id).at(-1); return { owner: change?.owner ?? request.assignedOwner, dueOn: change?.dueOn ?? request.dueOn, overdue: (asOf: string) => (change?.dueOn ?? request.dueOn) < asOf } }
export function escalateCorrectionDeadline(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; correctionRequestId: string; owner: string; dueOn: string; reason: string; evidenceReference: string; escalatedBy: string; escalatedOn: string }) {
  if (state.correctionSchedule.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before correction escalation.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can escalate and reassign correction work.')
  const request = state.correctionRequests.find((item) => item.id === command.correctionRequestId)
  const assignment = correctionAssignment(state, command.correctionRequestId)
  if (!request || !assignment || state.followUpDrafts.some((item) => item.correctionRequestId === request.id)) throw new Error('An unresolved active correction request is required.')
  const latest = state.followUpDrafts.filter((item) => item.obligationId === request.obligationId).at(-1)
  if (latest?.id !== request.sourceDraftId) throw new Error('Correction request targets a superseded response draft.')
  if (!command.owner.trim() || command.owner.trim() === assignment.owner || command.dueOn <= command.escalatedOn || command.reason.trim().length < 20 || !command.evidenceReference.trim() || !command.escalatedBy.trim()) throw new Error('A new owner, future deadline, escalation reason, and evidence are required.')
  const next = structuredClone(state)
  next.correctionSchedule.push({ id: command.id, correctionRequestId: request.id, previousOwner: assignment.owner, owner: command.owner.trim(), previousDueOn: assignment.dueOn, dueOn: command.dueOn, reason: command.reason.trim(), evidenceReference: command.evidenceReference.trim(), escalatedBy: command.escalatedBy.trim(), escalatedOn: command.escalatedOn, immutable: true })
  next.revision += 1
  return next
}
export const dispatchRetryPolicy = { maximumAttemptsPerRelease: 3 } as const
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
  const releaseAttempts = state.dispatchAttempts.filter((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference)
  if (releaseAttempts.length === 0 && command.releaseRevision !== state.revision) throw new Error('Dispatch targets a stale approved release revision.')
  const attempts = state.dispatchAttempts.filter((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference && item.releaseRevision === command.releaseRevision)
  if (attempts.some((item) => item.status === 'succeeded')) throw new Error('This approved release was already dispatched successfully.')
  if (attempts.length >= dispatchRetryPolicy.maximumAttemptsPerRelease) throw new Error('Dispatch retry limit reached for this release revision.')
  if (command.retryOf) { const previous = releaseAttempts.find((item) => item.id === command.retryOf); if (previous?.status !== 'failed' || !previous.retryEligible || previous.releaseRevision !== command.releaseRevision) throw new Error('Dispatch retry must reference an eligible failed attempt for this release revision.'); if (state.dispatchAttempts.some((item) => item.responseId === command.responseId && item.releaseRevision > previous.releaseRevision)) throw new Error('A newer approved release superseded this failed dispatch attempt.') }
  if (command.status === 'failed' ? !command.failureClassification : !command.dispatchEvidence) throw new Error('Dispatch result evidence is incomplete.')
  const next = structuredClone(state)
  next.dispatchAttempts.push({ ...command, attemptNumber: attempts.length + 1, immutable: true })
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

interface RecordRegulatoryFollowUp { id: string; expectedRevision: number; role: RegulatorControlRole; obligationId: string; responseId: string; releaseReference: string; obligationType: RegulatoryFollowUpEvent['obligationType']; deadline: string; owner: string; stage: RegulatoryFollowUpStage; evidenceReference: string; actor: string; occurredOn: string }
export function recordRegulatoryFollowUp(state: RegulatorResponseState, command: RecordRegulatoryFollowUp) {
  if (state.followUpEvents.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before recording follow-up work.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can control regulator follow-up obligations.')
  const closure = state.closures.find((item) => item.responseId === command.responseId && item.releaseReference === command.releaseReference)
  if (!closure) throw new Error('Follow-up must reference the acknowledged immutable regulator release.')
  const history = state.followUpEvents.filter((item) => item.obligationId === command.obligationId)
  const order: RegulatoryFollowUpStage[] = ['opened', 'drafted', 'approved', 'dispatched', 'acknowledged', 'closed']
  const previous = history.at(-1)
  if ((history.length === 0 && command.stage !== 'opened') || (previous && order.indexOf(command.stage) !== order.indexOf(previous.stage) + 1)) throw new Error('Regulator follow-up stages must preserve approval, dispatch, acknowledgement, and closure order.')
  if (!command.deadline || !command.owner || !command.evidenceReference.trim()) throw new Error('Follow-up deadline, owner, and stage evidence are required.')
  const latestDraft = state.followUpDrafts.filter((item) => item.obligationId === command.obligationId).at(-1)
  if (command.stage === 'approved' && latestDraft) {
    if (command.evidenceReference !== latestDraft.id) throw new Error('Legal approval must reference the latest obligation-specific draft.')
    if (state.followUpReviews.filter((item) => item.draftId === latestDraft.id).at(-1)?.decision !== 'approved') throw new Error('Latest follow-up draft requires an approved review before release.')
  }
  const next = structuredClone(state)
  next.followUpEvents.push({ ...command, evidenceReference: command.evidenceReference.trim(), sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function draftRegulatoryFollowUp(state: RegulatorResponseState, command: { id: string; expectedRevision: number; role: RegulatorControlRole; obligationId: string; requestedInformation: string; responseStatement: string; evidenceReferences: string[]; amendmentReason: string | null; owner: string; draftedBy: string; draftedOn: string }) {
  if (state.followUpDrafts.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Regulator response changed. Refresh before drafting the follow-up.')
  if (!(new Set<string>(['Compliance Analyst', 'Compliance Lead'])).has(command.role)) throw new Error('Only compliance staff can draft regulator follow-up responses.')
  const history = state.followUpEvents.filter((item) => item.obligationId === command.obligationId)
  const obligation = history.at(-1)
  if (!obligation || !['opened', 'drafted'].includes(obligation.stage)) throw new Error('An open regulator follow-up obligation is required for drafting.')
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
  if (latest.id !== command.draftId || (stage !== 'opened' && stage !== 'drafted')) throw new Error('Review must target the latest open obligation draft.')
  if (!command.reviewer.trim() || command.rationale.trim().length < 15) throw new Error('Reviewer and decision rationale are required.')
  if (latest.draftedBy.trim().toLowerCase() === command.reviewer.trim().toLowerCase()) throw new Error('Draft author cannot independently review the same response.')
  if (state.followUpReviews.some((item) => item.draftId === latest.id)) throw new Error('This draft already has a review decision. Prepare an amended draft.')
  const next = structuredClone(state)
  next.followUpReviews.push({ id: command.id, obligationId: command.obligationId, draftId: latest.id, sourceReleaseReference: latest.sourceReleaseReference, decision: command.decision, rationale: command.rationale.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, immutable: true })
  if (command.decision === 'returned') { const obligation = state.followUpEvents.filter((item) => item.obligationId === command.obligationId).at(-1); if (!obligation || command.reviewedOn > obligation.deadline) throw new Error('Correction assignment requires a current obligation deadline.'); next.correctionRequests.push({ id: `${command.id}:correction`, obligationId: command.obligationId, returnedReviewId: command.id, sourceDraftId: latest.id, assignedOwner: latest.owner, requestedChanges: command.rationale.trim(), evidenceRequirement: latest.requestedInformation, dueOn: obligation.deadline, requestedOn: command.reviewedOn, immutable: true }) }
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
  const blockers = [...(!sourceRelease ? ['Acknowledged source release unavailable'] : []), ...(draft.evidenceReferences.length === 0 ? ['Selected evidence missing'] : []), ...(review?.decision === 'returned' ? ['Current draft returned for correction'] : !review ? ['Current draft requires independent review'] : []), ...(obligation?.stage !== 'approved' && obligation?.stage !== 'dispatched' && obligation?.stage !== 'acknowledged' && obligation?.stage !== 'closed' ? ['Follow-up approval stage pending'] : [])]
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
  load() { const raw = this.storage.getItem(BrowserRegulatorResponsePersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<RegulatorResponseState>; return { ...(saved as RegulatorResponseState), reviewHistory: saved.reviewHistory ?? [], dispatchAttempts: saved.dispatchAttempts ?? [], followUpEvents: saved.followUpEvents ?? [], followUpDrafts: saved.followUpDrafts ?? [], followUpReviews: saved.followUpReviews ?? [], correctionRequests: saved.correctionRequests ?? [], correctionSchedule: saved.correctionSchedule ?? [], closures: saved.closures ?? [] } }
  save(state: RegulatorResponseState) { this.storage.setItem(BrowserRegulatorResponsePersistence.key, JSON.stringify(state)) }
}
export class RegulatorResponseRepository {
  private readonly persistence: RegulatorResponsePersistence
  constructor(persistence: RegulatorResponsePersistence | Pick<Storage, 'getItem' | 'setItem'>) { this.persistence = 'load' in persistence ? persistence : new BrowserRegulatorResponsePersistence(persistence) }
  read(): RegulatorResponseState { return this.persistence.load() ?? structuredClone(initialRegulatorResponseState) }
  dispatch(command: RescheduleLegalReview | RecordResponseDispatch | CloseRegulatoryObligation | RecordRegulatoryFollowUp | Parameters<typeof draftRegulatoryFollowUp>[1] | Parameters<typeof reviewRegulatoryFollowUpDraft>[1] | Parameters<typeof escalateCorrectionDeadline>[1]) { const current = this.read(); const next = 'correctionRequestId' in command ? escalateCorrectionDeadline(current, command) : 'decision' in command ? reviewRegulatoryFollowUpDraft(current, command) : 'responseStatement' in command ? draftRegulatoryFollowUp(current, command) : 'obligationId' in command ? recordRegulatoryFollowUp(current, command) : 'regulatorAcknowledgement' in command ? closeRegulatoryObligation(current, command) : 'releaseRevision' in command ? recordResponseDispatchAttempt(current, command) : rescheduleLegalReview(current, command); if (next !== current) this.persistence.save(next); return next }
}
