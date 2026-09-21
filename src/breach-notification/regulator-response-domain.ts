import { seededRegulatorResponses, type RegulatorResponseRecord } from './regulator-readiness'

export type RegulatorControlRole = 'Compliance Analyst' | 'Compliance Lead'
export interface LegalReviewChange { id: string; responseId: string; previousReviewer: string | null; reviewer: string; previousReviewOn: string | null; reviewOn: string; reason: string; deadline: string; immutable: true }
export interface RegulatoryClosure { id: string; responseId: string; reviewChangeId: string; evidenceIds: string[]; legalApproval: string; complianceApproval: string; releaseReference: string; dispatchEvidence: string; regulatorAcknowledgement: string; outstandingFollowUps: 0; closedBy: string; closedOn: string; immutable: true }
export interface ResponseDispatchAttempt { id: string; responseId: string; releaseReference: string; releaseRevision: number; attemptNumber: number; status: 'failed' | 'succeeded'; failureClassification: string | null; retryEligible: boolean; actor: string; attemptedOn: string; retryOf: string | null; dispatchEvidence: string | null; immutable: true }
export interface RegulatorResponseState { revision: number; responses: RegulatorResponseRecord[]; reviewHistory: LegalReviewChange[]; dispatchAttempts: ResponseDispatchAttempt[]; closures: RegulatoryClosure[] }
export const initialRegulatorResponseState: RegulatorResponseState = { revision: 0, responses: structuredClone(seededRegulatorResponses), reviewHistory: [], dispatchAttempts: [], closures: [] }
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
  load() { const raw = this.storage.getItem(BrowserRegulatorResponsePersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<RegulatorResponseState>; return { ...(saved as RegulatorResponseState), reviewHistory: saved.reviewHistory ?? [], dispatchAttempts: saved.dispatchAttempts ?? [], closures: saved.closures ?? [] } }
  save(state: RegulatorResponseState) { this.storage.setItem(BrowserRegulatorResponsePersistence.key, JSON.stringify(state)) }
}
export class RegulatorResponseRepository {
  private readonly persistence: RegulatorResponsePersistence
  constructor(persistence: RegulatorResponsePersistence | Pick<Storage, 'getItem' | 'setItem'>) { this.persistence = 'load' in persistence ? persistence : new BrowserRegulatorResponsePersistence(persistence) }
  read(): RegulatorResponseState { return this.persistence.load() ?? structuredClone(initialRegulatorResponseState) }
  dispatch(command: RescheduleLegalReview | RecordResponseDispatch | CloseRegulatoryObligation) { const current = this.read(); const next = 'regulatorAcknowledgement' in command ? closeRegulatoryObligation(current, command) : 'releaseRevision' in command ? recordResponseDispatchAttempt(current, command) : rescheduleLegalReview(current, command); if (next !== current) this.persistence.save(next); return next }
}
