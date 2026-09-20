import { seededRegulatorResponses, type RegulatorResponseRecord } from './regulator-readiness'

export type RegulatorControlRole = 'Compliance Analyst' | 'Compliance Lead'
export interface LegalReviewChange { id: string; responseId: string; previousReviewer: string | null; reviewer: string; previousReviewOn: string | null; reviewOn: string; reason: string; deadline: string; immutable: true }
export interface RegulatoryClosure { id: string; responseId: string; reviewChangeId: string; evidenceIds: string[]; legalApproval: string; complianceApproval: string; releaseReference: string; dispatchEvidence: string; regulatorAcknowledgement: string; outstandingFollowUps: 0; closedBy: string; closedOn: string; immutable: true }
export interface ResponseDispatchAttempt { id: string; responseId: string; releaseReference: string; dispatchEvidence: string; status: 'succeeded'; attemptedOn: string; immutable: true }
export interface RegulatorResponseState { revision: number; responses: RegulatorResponseRecord[]; reviewHistory: LegalReviewChange[]; dispatchAttempts: ResponseDispatchAttempt[]; closures: RegulatoryClosure[] }
export const initialRegulatorResponseState: RegulatorResponseState = { revision: 0, responses: structuredClone(seededRegulatorResponses), reviewHistory: [], dispatchAttempts: [], closures: [] }
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
  const next = structuredClone(state)
  const target = next.responses.find((item) => item.responseId === response.responseId)
  if (!target) throw new Error('Regulator response disappeared during closure.')
  next.dispatchAttempts.push({ id: `${command.id}:dispatch`, responseId: command.responseId, releaseReference: command.releaseReference, dispatchEvidence: command.dispatchEvidence, status: 'succeeded', attemptedOn: command.closedOn, immutable: true })
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
    ...state.dispatchAttempts.filter((item) => item.responseId === responseId).map((item) => ({ kind: 'dispatch' as const, occurredOn: item.attemptedOn, evidence: item.dispatchEvidence })),
    ...state.closures.filter((item) => item.responseId === responseId).map((item) => ({ kind: 'closure' as const, occurredOn: item.closedOn, evidence: item.regulatorAcknowledgement })),
  ].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
}

export class RegulatorResponseRepository {
  static key = 'sentinelarc:regulator-response-control:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): RegulatorResponseState { const raw = this.storage.getItem(RegulatorResponseRepository.key); return raw ? JSON.parse(raw) as RegulatorResponseState : structuredClone(initialRegulatorResponseState) }
  dispatch(command: RescheduleLegalReview | CloseRegulatoryObligation) { const current = this.read(); const next = 'dispatchEvidence' in command ? closeRegulatoryObligation(current, command) : rescheduleLegalReview(current, command); if (next !== current) this.storage.setItem(RegulatorResponseRepository.key, JSON.stringify(next)); return next }
}
