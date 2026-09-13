export type NotificationRole = 'Incident Commander' | 'Privacy Counsel' | 'Evidence Custodian' | 'Communications Lead' | 'Auditor';
export interface BreachNotificationState {
  revision: number;
  incident: { id: string; version: number; status: 'contained' | 'notified'; affectedSubjects: number; discoveredOn: string };
  evidence: { id: string; version: number; status: 'sealed' | 'released'; checksum: string };
  legal: { jurisdiction: string; deadline: string; threshold: number; assessmentVersion: number };
  notice: null | { id: string; status: 'draft' | 'evidence-attached' | 'legally-approved' | 'released' | 'verified' | 'cancelled'; owner: string; incidentVersion: number; evidenceVersion: number; assessmentVersion: number; recipients: number; evidenceCustodian?: string; counsel?: string; releaseId?: string };
  delivery: { regulator: 'pending' | 'accepted'; subjects: 'pending' | 'delivered'; delivered: number; failures: number };
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialBreachNotificationState: BreachNotificationState = {
  revision: 0,
  incident: { id: 'INC-204', version: 8, status: 'contained', affectedSubjects: 126, discoveredOn: '2026-09-11' },
  evidence: { id: 'EVID-204', version: 5, status: 'sealed', checksum: 'sha256:8cf72a' },
  legal: { jurisdiction: 'EG-DPL', deadline: '2026-09-14', threshold: 100, assessmentVersion: 3 },
  notice: null,
  delivery: { regulator: 'pending', subjects: 'pending', delivered: 0, failures: 0 },
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
export function releaseNotification(state: BreachNotificationState, command: Meta & { delivered: number; failures: number }) {
  assert(command.actor.role === 'Communications Lead', 'Only communications leads can release notifications.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'legally-approved', 'Legal approval is required before release.'); assert(Number.isInteger(command.delivered) && Number.isInteger(command.failures) && command.delivered + command.failures === current.recipients, 'Delivery totals must reconcile to affected subjects.'); assert(command.failures === 0, 'Failed subject deliveries must be retried before release completes.'); assertVersions(next);
  current.status = 'released'; current.releaseId = command.id; next.delivery.regulator = 'accepted'; next.delivery.subjects = 'delivered'; next.delivery.delivered = command.delivered; next.delivery.failures = command.failures;
  return finish(next, command, 'breach-notification-released', `${String(command.delivered)} recipients`);
}
export function verifyNotification(state: BreachNotificationState, command: Meta) {
  assert(command.actor.role === 'Auditor', 'Only auditors can verify notification completion.');
  const next = begin(state, command), current = notice(next);
  assert(current.status === 'released' && next.delivery.regulator === 'accepted' && next.delivery.subjects === 'delivered', 'Completed regulator and subject delivery is required.'); assert(command.actor.id !== current.counsel && command.actor.id !== current.evidenceCustodian, 'Final verification must be independent.');
  current.status = 'verified'; next.incident.status = 'notified'; next.incident.version += 1;
  return finish(next, command, 'breach-notification-verified', current.releaseId ?? 'release');
}
export function cancelNotification(state: BreachNotificationState, command: Meta & { reason: string }) { assert(command.actor.role === 'Incident Commander', 'Only incident commanders can cancel notifications.'); const next = begin(state, command), current = notice(next); assert(command.actor.id === current.owner && ['draft', 'evidence-attached'].includes(current.status), 'Only the owner can cancel before legal approval.'); assert(command.reason.trim().length >= 16, 'Cancellation reason must contain at least 16 characters.'); current.status = 'cancelled'; return finish(next, command, 'notification-dossier-cancelled', command.reason.trim()); }
export class BreachNotificationRepository { static key = 'sentinelarc:breach-notification:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(BreachNotificationRepository.key); return raw ? JSON.parse(raw) as BreachNotificationState : structuredClone(initialBreachNotificationState); } commit(expected: number, operation: (state: BreachNotificationState) => BreachNotificationState) { const current = this.read(); assert(current.revision === expected, 'Another session changed notification delivery. Refresh before retrying.'); const next = operation(current); this.storage.setItem(BreachNotificationRepository.key, JSON.stringify(next)); return next; } }
