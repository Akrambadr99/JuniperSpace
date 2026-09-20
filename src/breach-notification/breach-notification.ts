import type { State as RetentionState } from '../evidence-retention/evidence-retention';
export type NotificationRole = 'Incident Commander' | 'Privacy Counsel' | 'Evidence Custodian' | 'Communications Lead' | 'Auditor';
export interface BreachNotificationState {
  revision: number;
  incident: { id: string; version: number; status: 'contained' | 'notified'; affectedSubjects: number; discoveredOn: string };
  evidence: { id: string; version: number; status: 'sealed' | 'released'; checksum: string; retentionEvidenceId: string; retentionRevision: number };
  legal: { jurisdiction: string; deadline: string; threshold: number; assessmentVersion: number };
  notice: null | { id: string; status: 'draft' | 'evidence-attached' | 'legally-approved' | 'delivery-partial' | 'released' | 'verified' | 'acknowledged' | 'cancelled'; owner: string; incidentVersion: number; evidenceVersion: number; assessmentVersion: number; recipients: number; evidenceCustodian?: string; counsel?: string; releaseId?: string };
  delivery: { regulator: 'pending' | 'accepted'; subjects: 'pending' | 'delivered'; delivered: number; failures: number };
  regulatorAcknowledgements: { id: string; reference: string; releaseId: string; immutable: true }[];
  regulatorFollowUps: { id: string; acknowledgementId: string; dueOn: string; question: string; status: 'open' | 'resolved'; responseReference?: string; immutable: true }[];
  evidenceAmendments: { id: string; followUpId: string; checksum: string; immutable: true }[];
  amendmentApprovals: { id: string; amendmentId: string; counsel: string; rationale: string; immutable: true }[];
  regulatorResponses: { id: string; followUpId: string; amendmentId: string; approvalId: string; responseReference: string; immutable: true }[];
  regulatoryCaseStatus: 'open' | 'closed';
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialBreachNotificationState: BreachNotificationState = {
  revision: 0,
  incident: { id: 'INC-204', version: 8, status: 'contained', affectedSubjects: 126, discoveredOn: '2026-09-11' },
  evidence: { id: 'EVID-204', version: 5, status: 'sealed', checksum: 'sha256:8cf72a', retentionEvidenceId: 'evidence-memory', retentionRevision: 7 },
  legal: { jurisdiction: 'EG-DPL', deadline: '2026-09-14', threshold: 100, assessmentVersion: 3 },
  notice: null,
  delivery: { regulator: 'pending', subjects: 'pending', delivered: 0, failures: 0 }, regulatorAcknowledgements: [], regulatorFollowUps: [], evidenceAmendments: [], amendmentApprovals: [], regulatorResponses: [], regulatoryCaseStatus: 'open',
  events: [],
};
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: NotificationRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: BreachNotificationState, command: Meta) { assert(state.revision === command.expectedRevision, 'Notification dossier changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: BreachNotificationState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function notice(state: BreachNotificationState) { assert(state.notice, 'No notification dossier exists.'); return state.notice; }
function assertVersions(state: BreachNotificationState) { const current = notice(state); assert(current.incidentVersion === state.incident.version && current.evidenceVersion === state.evidence.version && current.assessmentVersion === state.legal.assessmentVersion, 'Incident, evidence, or legal assessment changed. Cancel and rebuild the notice.'); }

export function openNotificationDossier(state: BreachNotificationState, command: Meta & { asOf: string }) {
  assert(command.actor.role === 'Incident Commander', 'Only incident commanders can open notification dossiers.');
  const next = begin(state, command);
  assert(next.incident.status === 'contained' && next.incident.affectedSubjects >= next.legal.threshold, 'Contained threshold-reaching incident is required.');
  assert(command.asOf <= next.legal.deadline, 'The regulatory notification deadline has passed.');
  assert(!next.notice || ['verified', 'cancelled'].includes(next.notice.status), 'A notification dossier is already active.');
  next.notice = { id: `${command.id}-notice`, status: 'draft', owner: command.actor.id, incidentVersion: next.incident.version, evidenceVersion: next.evidence.version, assessmentVersion: next.legal.assessmentVersion, recipients: next.incident.affectedSubjects };
  return finish(next, command, 'notification-dossier-opened', next.incident.id);
}
export function attachSealedEvidence(state: BreachNotificationState, command: Meta & { checksum: string }) {
  assert(command.actor.role === 'Evidence Custodian', 'Only evidence custodians can attach notification evidence.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'draft', 'Draft notification is required.'); assert(command.actor.id !== current.owner, 'Evidence custody must be independent.'); assertVersions(next);
  assert(next.evidence.status === 'sealed' && command.checksum === next.evidence.checksum, 'Sealed evidence checksum does not match.');
  current.status = 'evidence-attached'; current.evidenceCustodian = command.actor.id;
  return finish(next, command, 'sealed-evidence-attached', command.checksum);
}
export function approveNotification(state: BreachNotificationState, command: Meta & { rationale: string }) {
  assert(command.actor.role === 'Privacy Counsel', 'Only privacy counsel can approve notifications.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'evidence-attached', 'Sealed evidence must be attached first.'); assert(command.actor.id !== current.evidenceCustodian && command.actor.id !== current.owner, 'Legal approval must be independent.'); assert(command.rationale.trim().length >= 24, 'Legal rationale must contain at least 24 characters.'); assertVersions(next);
  current.status = 'legally-approved'; current.counsel = command.actor.id;
  return finish(next, command, 'breach-notification-approved', command.rationale.trim());
}
export function synchronizeRetainedEvidence(state: BreachNotificationState, retention: RetentionState, command: Meta) {
  assert(command.actor.role === 'Evidence Custodian', 'Only evidence custodians can synchronize retained evidence.'); const next = begin(state, command);
  assert(retention.evidence.id === next.evidence.retentionEvidenceId && retention.evidence.status === 'held' && retention.hold?.status === 'applied', 'Applied hold for linked evidence is required.'); assert(retention.evidence.revision > next.evidence.retentionRevision, 'Retained evidence is already current.');
  assert(!next.notice || !['delivery-partial', 'released', 'verified'].includes(next.notice.status), 'Released notification evidence cannot be replaced.');
  next.evidence.checksum = retention.evidence.digest; next.evidence.version += 1; next.evidence.retentionRevision = retention.evidence.revision;
  if (next.notice) { next.notice.status = 'draft'; next.notice.evidenceVersion = next.evidence.version; delete next.notice.evidenceCustodian; delete next.notice.counsel; }
  return finish(next, command, 'retained-evidence-synchronized', retention.evidence.digest);
}
export function releaseNotification(state: BreachNotificationState, command: Meta & { delivered: number; failures: number }) {
  assert(command.actor.role === 'Communications Lead', 'Only communications leads can release notifications.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'legally-approved', 'Legal approval is required before release.'); assert(Number.isInteger(command.delivered) && Number.isInteger(command.failures) && command.delivered >= 0 && command.failures >= 0 && command.delivered + command.failures === current.recipients, 'Delivery totals must reconcile to affected subjects.'); assertVersions(next);
  current.status = command.failures === 0 ? 'released' : 'delivery-partial'; current.releaseId = command.id; next.delivery.regulator = 'accepted'; next.delivery.subjects = command.failures === 0 ? 'delivered' : 'pending'; next.delivery.delivered = command.delivered; next.delivery.failures = command.failures;
  return finish(next, command, command.failures === 0 ? 'breach-notification-released' : 'breach-notification-partially-delivered', `${String(command.delivered)} delivered:${String(command.failures)} failed`);
}
export function retryFailedNotification(state: BreachNotificationState, command: Meta & { delivered: number; failures: number }) {
  assert(command.actor.role === 'Communications Lead', 'Only communications leads can retry notification delivery.');
  const next = begin(state, command), current = notice(next), pending = next.delivery.failures;
  assert(current.status === 'delivery-partial' && pending > 0, 'A partially delivered notification is required.'); assert(Number.isInteger(command.delivered) && Number.isInteger(command.failures) && command.delivered >= 0 && command.failures >= 0 && command.delivered + command.failures === pending, 'Retry totals must reconcile to failed recipients.'); assertVersions(next);
  next.delivery.delivered += command.delivered; next.delivery.failures = command.failures; next.delivery.subjects = command.failures === 0 ? 'delivered' : 'pending'; if (command.failures === 0) current.status = 'released';
  return finish(next, command, command.failures === 0 ? 'breach-notification-retry-completed' : 'breach-notification-retry-partial', `${String(command.delivered)} recovered:${String(command.failures)} failed`);
}
export function verifyNotification(state: BreachNotificationState, command: Meta) {
  assert(command.actor.role === 'Auditor', 'Only auditors can verify notification completion.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'released' && next.delivery.regulator === 'accepted' && next.delivery.subjects === 'delivered', 'Completed regulator and subject delivery is required.'); assert(command.actor.id !== current.counsel && command.actor.id !== current.evidenceCustodian, 'Final verification must be independent.');
  current.status = 'verified'; next.incident.status = 'notified'; next.incident.version += 1;
  return finish(next, command, 'breach-notification-verified', current.releaseId ?? 'release');
}
export function recordRegulatorAcknowledgement(state: BreachNotificationState, command: Meta & { reference: string }) { assert(command.actor.role === 'Privacy Counsel', 'Only privacy counsel can record regulator acknowledgement.'); const next = begin(state, command), current = notice(next); assert(current.status === 'verified' && current.releaseId, 'Verified notification release is required.'); assert(/^REG-[A-Z0-9]{9,12}$/.test(command.reference), 'Valid regulator acknowledgement reference is required.'); assert(next.regulatorAcknowledgements.length === 0, 'Regulator acknowledgement was already recorded.'); next.regulatorAcknowledgements.push({ id: `${command.id}-acknowledgement`, reference: command.reference, releaseId: current.releaseId, immutable: true }); current.status = 'acknowledged'; return finish(next, command, 'regulator-acknowledgement-recorded', command.reference); }
export function recordRegulatorFollowUp(state: BreachNotificationState, command: Meta & { dueOn: string; question: string }) { assert(command.actor.role === 'Privacy Counsel', 'Only privacy counsel can record regulator follow-up.'); const next = begin(state, command), current = notice(next), acknowledgement = next.regulatorAcknowledgements[0]; assert(current.status === 'acknowledged' && acknowledgement, 'Regulator acknowledgement is required.'); assert(command.dueOn === '2026-09-20', 'Follow-up must use the regulator response deadline.'); assert(command.question.trim().length >= 20, 'Regulator question must contain at least 20 characters.'); assert(next.regulatorFollowUps.length === 0, 'Regulator follow-up was already recorded.'); next.regulatorFollowUps.push({ id: `${command.id}-follow-up`, acknowledgementId: acknowledgement.id, dueOn: command.dueOn, question: command.question.trim(), status: 'open', immutable: true }); return finish(next, command, 'regulator-follow-up-recorded', command.dueOn); }
export function resolveRegulatorFollowUp(state: BreachNotificationState, command: Meta & { checksum: string; responseReference: string }) { assert(command.actor.role === 'Evidence Custodian', 'Only evidence custodians can resolve regulator follow-up evidence.'); const next = begin(state, command), followUp = next.regulatorFollowUps[0]; assert(followUp?.status === 'open', 'Open regulator follow-up is required.'); assert(/^[a-f0-9]{16,64}$/.test(command.checksum), 'Valid evidence amendment checksum is required.'); assert(/^RESP-[A-Z0-9]{8}$/.test(command.responseReference), 'Valid regulator response reference is required.'); next.evidenceAmendments.push({ id: `${command.id}-amendment`, followUpId: followUp.id, checksum: command.checksum, immutable: true }); followUp.status = 'resolved'; followUp.responseReference = command.responseReference; return finish(next, command, 'regulator-follow-up-resolved', command.responseReference); }
export function approveRegulatorAmendment(state: BreachNotificationState, command: Meta & { rationale: string }) { assert(command.actor.role === 'Privacy Counsel', 'Only privacy counsel can approve regulator amendments.'); const next = begin(state, command), followUp = next.regulatorFollowUps[0], amendment = next.evidenceAmendments.at(-1); assert(next.notice?.status === 'acknowledged' && followUp?.status === 'resolved' && amendment, 'Resolved follow-up amendment is required.'); assert(command.rationale.trim().length >= 24, 'Amendment approval rationale must contain at least 24 characters.'); assert(next.amendmentApprovals.length === 0, 'Regulator amendment was already approved.'); next.amendmentApprovals.push({ id: `${command.id}-approval`, amendmentId: amendment.id, counsel: command.actor.id, rationale: command.rationale.trim(), immutable: true }); return finish(next, command, 'regulator-amendment-approved', amendment.id); }
export function dispatchRegulatorResponse(state: BreachNotificationState, command: Meta) { assert(command.actor.role === 'Communications Lead', 'Only communications leads can dispatch regulator responses.'); const next = begin(state, command), followUp = next.regulatorFollowUps[0], amendment = next.evidenceAmendments.at(-1), approval = next.amendmentApprovals.at(-1); assert(next.regulatoryCaseStatus === 'open' && followUp?.status === 'resolved' && followUp.responseReference && amendment && approval?.amendmentId === amendment.id, 'Approved regulator amendment is required before dispatch.'); assert(command.actor.id !== approval.counsel, 'Response dispatch must remain independent from legal approval.'); next.regulatorResponses.push({ id: `${command.id}-response`, followUpId: followUp.id, amendmentId: amendment.id, approvalId: approval.id, responseReference: followUp.responseReference, immutable: true }); next.regulatoryCaseStatus = 'closed'; return finish(next, command, 'regulator-response-dispatched', followUp.responseReference); }
export function cancelNotification(state: BreachNotificationState, command: Meta & { reason: string }) { assert(command.actor.role === 'Incident Commander', 'Only incident commanders can cancel notifications.'); const next = begin(state, command), current = notice(next); assert(command.actor.id === current.owner && ['draft', 'evidence-attached'].includes(current.status), 'Only the owner can cancel before legal approval.'); assert(command.reason.trim().length >= 16, 'Cancellation reason must contain at least 16 characters.'); current.status = 'cancelled'; return finish(next, command, 'notification-dossier-cancelled', command.reason.trim()); }
export class BreachNotificationRepository { static key = 'sentinelarc:breach-notification:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(BreachNotificationRepository.key); return raw ? JSON.parse(raw) as BreachNotificationState : structuredClone(initialBreachNotificationState); } commit(expected: number, operation: (state: BreachNotificationState) => BreachNotificationState) { const current = this.read(); assert(current.revision === expected, 'Another session changed notification delivery. Refresh before retrying.'); const next = operation(current); this.storage.setItem(BreachNotificationRepository.key, JSON.stringify(next)); return next; } }
