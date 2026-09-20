/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { regulatorResponseReadiness, seededRegulatorResponses, type RegulatorResponseRecord } from './regulator-readiness'

export type RegulatorControlRole = 'Compliance Analyst' | 'Compliance Lead'
export interface LegalReviewChange { id: string; responseId: string; previousReviewer: string | null; reviewer: string; previousReviewOn: string | null; reviewOn: string; reason: string; deadline: string; immutable: true }
export interface RegulatorResponseState { revision: number; responses: RegulatorResponseRecord[]; reviewHistory: LegalReviewChange[] }
export const initialRegulatorResponseState: RegulatorResponseState = { revision: 0, responses: structuredClone(seededRegulatorResponses), reviewHistory: [] }
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

export class RegulatorResponseRepository {
  static key = 'sentinelarc:regulator-response-control:v1'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): RegulatorResponseState { const raw = this.storage.getItem(RegulatorResponseRepository.key); return raw ? JSON.parse(raw) as RegulatorResponseState : structuredClone(initialRegulatorResponseState) }
  dispatch(command: RescheduleLegalReview) { const current = this.read(); const next = rescheduleLegalReview(current, command); if (next !== current) this.storage.setItem(RegulatorResponseRepository.key, JSON.stringify(next)); return next }
}

export function RegulatorResponseControl() {
  const [repository] = useState(() => new RegulatorResponseRepository(localStorage)); const [state, setState] = useState(() => repository.read()); const [role, setRole] = useState<RegulatorControlRole>('Compliance Analyst'); const [message, setMessage] = useState(''); const feedback = useRef<HTMLParagraphElement>(null); const readiness = regulatorResponseReadiness(state.responses, '2026-10-20')
  const reschedule = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, responseId: 'REG-FCA-204', reviewer: 'Senior privacy counsel', reviewOn: '2026-10-20T18:00:00Z', asOf: '2026-10-20T09:00:00Z', reason: 'Evidence blocker requires senior counsel review before deadline.' })); setMessage('Legal review reassigned and rescheduled before the response deadline.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Legal review scheduling failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Regulator response readiness"><h2>Regulator response readiness</h2><label>Response control role<select value={role} onChange={(event) => { setRole(event.target.value as RegulatorControlRole) }}><option>Compliance Analyst</option><option>Compliance Lead</option></select></label>{readiness.map((item) => <p key={item.responseId}>{item.responseId} · {item.regulator} · {item.priority} · {item.blockers.join(', ') || 'clear'}</p>)}<button disabled={role !== 'Compliance Lead' || state.reviewHistory.length > 0} onClick={reschedule}>Reassign urgent legal review</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Legal review schedule history">{state.reviewHistory.map((item) => <li key={item.id}>{item.responseId} · {item.previousReviewer ?? 'unassigned'} to {item.reviewer} · review {item.reviewOn} · deadline {item.deadline}</li>)}</ol></section>
}
