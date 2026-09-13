export type InvestigationRole = 'SOC Analyst' | 'Evidence Custodian' | 'Incident Commander' | 'Security Engineer' | 'Auditor';

export interface InvestigationState {
  revision: number;
  alert: { id: string; status: 'open' | 'contained' | 'closed'; version: number; severity: 'critical' };
  identity: { id: string; status: 'active' | 'contained' | 'restored'; version: number; activeSessions: number };
  evidence: { id: string; status: 'captured' | 'sealed'; version: number; checksum: string; custodian: string };
  dossier: {
    id: string;
    owner: string;
    status: 'opened' | 'evidence-accepted' | 'containment-approved' | 'contained' | 'verified' | 'closed';
    alertVersion: number;
    identityVersion: number;
    evidenceVersion: number;
    evidenceChecksum: string;
    custodian?: string;
    commander?: string;
    containmentActions: string[];
    verifier?: string;
  } | null;
  telemetry: { version: number; activeSessions: number; maliciousHits: number; fresh: boolean };
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialInvestigationState: InvestigationState = {
  revision: 0,
  alert: { id: 'ALERT-940', status: 'open', version: 6, severity: 'critical' },
  identity: { id: 'svc-payments', status: 'active', version: 4, activeSessions: 3 },
  evidence: { id: 'EVID-940', status: 'captured', version: 2, checksum: 'sha256:940abc', custodian: 'custodian' },
  dossier: null,
  telemetry: { version: 8, activeSessions: 3, maliciousHits: 7, fresh: true },
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: InvestigationRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: InvestigationState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Investigation dossier changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}
function finish(state: InvestigationState, command: Meta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}
function dossier(state: InvestigationState) {
  const current = state.dossier;
  assert(current, 'Investigation dossier does not exist.');
  return current;
}
function assertEvidenceIntegrity(state: InvestigationState) {
  const current = dossier(state);
  assert(current.evidenceVersion === state.evidence.version, 'Evidence version changed. Revalidate custody.');
  assert(current.evidenceChecksum === state.evidence.checksum, 'Evidence checksum changed. Quarantine the investigation.');
}

export function openInvestigation(state: InvestigationState, command: Meta) {
  assert(command.actor.role === 'SOC Analyst', 'Only SOC analysts can open investigations.');
  const next = begin(state, command);
  assert(next.alert.status === 'open', 'Open alert is required.');
  assert(!next.dossier || next.dossier.status === 'closed', 'An active investigation exists.');
  next.dossier = {
    id: command.id + '-investigation', owner: command.actor.id, status: 'opened',
    alertVersion: next.alert.version, identityVersion: next.identity.version,
    evidenceVersion: next.evidence.version, evidenceChecksum: next.evidence.checksum,
    containmentActions: [],
  };
  return finish(next, command, 'investigation-opened', next.alert.id);
}

export function sealInvestigationEvidence(state: InvestigationState, command: Meta & { checksum: string }) {
  assert(command.actor.role === 'Evidence Custodian', 'Only evidence custodians can seal investigation evidence.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'opened', 'Investigation is not awaiting evidence acceptance.');
  assert(command.actor.id === next.evidence.custodian, 'Only the assigned custodian can seal this evidence.');
  assert(command.checksum === next.evidence.checksum, 'Evidence checksum does not match the captured artifact.');
  next.evidence.status = 'sealed';
  next.evidence.version += 1;
  current.evidenceVersion = next.evidence.version;
  current.custodian = command.actor.id;
  current.status = 'evidence-accepted';
  return finish(next, command, 'investigation-evidence-sealed', next.evidence.id);
}

export function approveContainment(state: InvestigationState, command: Meta & { actions: string[]; rationale: string }) {
  assert(command.actor.role === 'Incident Commander', 'Only incident commanders can approve containment.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'evidence-accepted', 'Sealed evidence is required before containment.');
  assertEvidenceIntegrity(next);
  assert(command.rationale.trim().length >= 20, 'Containment rationale must contain at least 20 characters.');
  const actions = [...new Set(command.actions.map((action) => action.trim()).filter(Boolean))];
  assert(actions.includes('revoke-sessions') && actions.includes('rotate-credential'), 'Containment must revoke sessions and rotate credentials.');
  current.containmentActions = actions;
  current.commander = command.actor.id;
  current.status = 'containment-approved';
  return finish(next, command, 'containment-approved', actions.join(', '));
}

export function executeContainment(state: InvestigationState, command: Meta) {
  assert(command.actor.role === 'Security Engineer', 'Only security engineers can execute containment.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'containment-approved', 'Approved containment is required.');
  assertEvidenceIntegrity(next);
  assert(current.identityVersion === next.identity.version, 'Identity changed before containment. Reassess actions.');
  next.identity.status = 'contained';
  next.identity.activeSessions = 0;
  next.identity.version += 1;
  next.alert.status = 'contained';
  next.alert.version += 1;
  next.telemetry.fresh = false;
  current.identityVersion = next.identity.version;
  current.alertVersion = next.alert.version;
  current.status = 'contained';
  return finish(next, command, 'containment-executed', next.identity.id);
}

export function refreshRemediationTelemetry(state: InvestigationState, command: Meta & { activeSessions: number; maliciousHits: number }) {
  assert(command.actor.role === 'Security Engineer', 'Only security engineers can refresh remediation telemetry.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'contained', 'Executed containment is required.');
  assert(Number.isInteger(command.activeSessions) && command.activeSessions >= 0, 'Active-session count is invalid.');
  assert(Number.isInteger(command.maliciousHits) && command.maliciousHits >= 0, 'Malicious-hit count is invalid.');
  next.telemetry = { version: next.telemetry.version + 1, activeSessions: command.activeSessions, maliciousHits: command.maliciousHits, fresh: true };
  return finish(next, command, 'remediation-telemetry-refreshed', String(next.telemetry.version));
}

export function verifyRemediation(state: InvestigationState, command: Meta & { rationale: string }) {
  assert(command.actor.role === 'Auditor', 'Only auditors can verify remediation.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'contained', 'Contained investigation is required.');
  assertEvidenceIntegrity(next);
  assert(command.actor.id !== current.commander && command.actor.id !== current.custodian, 'Remediation verification must be independent.');
  assert(command.rationale.trim().length >= 20, 'Verification rationale must contain at least 20 characters.');
  assert(next.telemetry.fresh && next.telemetry.activeSessions === 0 && next.telemetry.maliciousHits === 0, 'Fresh zero-risk telemetry is required.');
  current.verifier = command.actor.id;
  current.status = 'verified';
  return finish(next, command, 'remediation-verified', current.id);
}

export function closeInvestigation(state: InvestigationState, command: Meta) {
  assert(command.actor.role === 'Incident Commander', 'Only incident commanders can close investigations.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'verified', 'Verified remediation is required for closure.');
  assert(current.verifier !== command.actor.id, 'Closure must remain independent from verification.');
  assertEvidenceIntegrity(next);
  next.identity.status = 'restored';
  next.identity.version += 1;
  next.alert.status = 'closed';
  next.alert.version += 1;
  current.status = 'closed';
  return finish(next, command, 'investigation-closed', next.alert.id);
}

export class InvestigationRepository {
  static key = 'sentinelarc:investigation-dossier:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(InvestigationRepository.key); return raw ? JSON.parse(raw) as InvestigationState : structuredClone(initialInvestigationState); }
  commit(expectedRevision: number, change: (state: InvestigationState) => InvestigationState) {
    const current = this.read();
    assert(current.revision === expectedRevision, 'Another session changed the investigation. Refresh before retrying.');
    const next = change(current);
    this.storage.setItem(InvestigationRepository.key, JSON.stringify(next));
    return next;
  }
}
