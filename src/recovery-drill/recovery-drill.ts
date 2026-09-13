export type RecoveryRole = 'Continuity Manager' | 'Backup Operator' | 'Platform Engineer' | 'Service Owner' | 'Security Auditor' | 'Change Manager';

export interface RecoveryDrillState {
  revision: number;
  service: {
    id: string;
    version: number;
    ownerId: string;
    status: 'online';
    productionChecksum: string;
    recoveryObjectiveMinutes: number;
  };
  snapshot: {
    id: string;
    version: number;
    status: 'sealed';
    checksum: string;
    createdAt: string;
  };
  sandbox: {
    id: string;
    version: number;
    status: 'empty' | 'isolated' | 'restored' | 'verified' | 'destroyed';
    networkAccess: 'none' | 'restricted';
    checksum?: string;
  };
  drill: null | {
    id: string;
    status: 'planned' | 'snapshot-validated' | 'sandbox-isolated' | 'restored' | 'owner-accepted' | 'security-verified' | 'closed';
    serviceVersion: number;
    snapshotVersion: number;
    sandboxVersion: number;
    startedAt: string;
    restoredAt?: string;
    elapsedMinutes?: number;
    owner: string;
    backupOperator?: string;
    engineer?: string;
    serviceOwner?: string;
    auditor?: string;
  };
  evidence: {
    id: string;
    kind: 'plan' | 'snapshot' | 'restore' | 'owner-acceptance' | 'security-verification' | 'closure';
    detail: string;
    immutable: true;
  }[];
  events: { id: string; action: string; actor: string }[];
}

export const initialRecoveryDrillState: RecoveryDrillState = {
  revision: 0,
  service: { id: 'SERVICE-VAULT', version: 14, ownerId: 'service-owner', status: 'online', productionChecksum: 'prod-91bc02de', recoveryObjectiveMinutes: 60 },
  snapshot: { id: 'SNAPSHOT-2026-09-12', version: 6, status: 'sealed', checksum: 'snap-a18b29c3', createdAt: '2026-09-12T01:00:00Z' },
  sandbox: { id: 'RECOVERY-SANDBOX-4', version: 3, status: 'empty', networkAccess: 'none' },
  drill: null,
  evidence: [],
  events: [],
};

interface Meta {
  id: string;
  expectedRevision: number;
  actor: { id: string; role: RecoveryRole };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: RecoveryDrillState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Recovery drill changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: RecoveryDrillState, command: Meta, action: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id });
  return state;
}

function current(state: RecoveryDrillState) {
  assert(state.drill, 'No recovery drill exists.');
  return state.drill;
}

function assertCurrent(state: RecoveryDrillState) {
  const drill = current(state);
  assert(drill.serviceVersion === state.service.version, 'Production service changed after drill planning.');
  assert(drill.snapshotVersion === state.snapshot.version, 'Backup snapshot changed after drill planning.');
  assert(drill.sandboxVersion === state.sandbox.version, 'Recovery sandbox changed after drill planning.');
}

function minutesBetween(start: string, end: string) {
  const startTime = Date.parse(start), endTime = Date.parse(end);
  assert(Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime, 'Recovery timestamps are invalid.');
  return Math.floor((endTime - startTime) / 60000);
}

export function planRecoveryDrill(state: RecoveryDrillState, command: Meta & { startedAt: string }) {
  assert(command.actor.role === 'Continuity Manager', 'Only continuity managers can plan recovery drills.');
  const next = begin(state, command);
  assert(!next.drill && next.sandbox.status === 'empty', 'Empty recovery sandbox without a drill is required.');
  assert(Date.parse(command.startedAt) > Date.parse(next.snapshot.createdAt), 'Recovery drill must start after snapshot creation.');
  next.drill = {
    id: `${command.id}-drill`,
    status: 'planned',
    serviceVersion: next.service.version,
    snapshotVersion: next.snapshot.version,
    sandboxVersion: next.sandbox.version,
    startedAt: command.startedAt,
    owner: command.actor.id,
  };
  next.evidence.push({ id: `${command.id}-plan`, kind: 'plan', detail: `${next.service.id}:${next.snapshot.id}`, immutable: true });
  return finish(next, command, 'recovery-drill-planned');
}

export function validateRecoverySnapshot(state: RecoveryDrillState, command: Meta & { observedChecksum: string }) {
  assert(command.actor.role === 'Backup Operator', 'Only backup operators can validate snapshots.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'planned' && command.actor.id !== drill.owner, 'Independent planned recovery drill is required.');
  assertCurrent(next);
  assert(command.observedChecksum === next.snapshot.checksum, 'Observed snapshot checksum does not match sealed provenance.');
  drill.status = 'snapshot-validated';
  drill.backupOperator = command.actor.id;
  next.evidence.push({ id: `${command.id}-snapshot`, kind: 'snapshot', detail: command.observedChecksum, immutable: true });
  return finish(next, command, 'recovery-snapshot-validated');
}

export function isolateRecoverySandbox(state: RecoveryDrillState, command: Meta) {
  assert(command.actor.role === 'Platform Engineer', 'Only platform engineers can isolate recovery sandboxes.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'snapshot-validated', 'Validated snapshot is required before sandbox isolation.');
  assertCurrent(next);
  assert(next.sandbox.networkAccess === 'none', 'Recovery sandbox must not have external network access.');
  next.sandbox.status = 'isolated';
  next.sandbox.version += 1;
  drill.sandboxVersion = next.sandbox.version;
  drill.status = 'sandbox-isolated';
  drill.engineer = command.actor.id;
  return finish(next, command, 'recovery-sandbox-isolated');
}

export function restoreRecoverySnapshot(state: RecoveryDrillState, command: Meta & { restoredAt: string; checksum: string }) {
  assert(command.actor.role === 'Backup Operator', 'Only backup operators can restore snapshots.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'sandbox-isolated' && command.actor.id === drill.backupOperator, 'Validating backup operator must restore into the isolated sandbox.');
  assertCurrent(next);
  assert(command.checksum === next.snapshot.checksum, 'Restored data does not match the sealed snapshot.');
  const elapsed = minutesBetween(drill.startedAt, command.restoredAt);
  assert(elapsed <= next.service.recoveryObjectiveMinutes, 'Recovery exceeded the service recovery objective.');
  next.sandbox.status = 'restored';
  next.sandbox.checksum = command.checksum;
  next.sandbox.version += 1;
  drill.sandboxVersion = next.sandbox.version;
  drill.restoredAt = command.restoredAt;
  drill.elapsedMinutes = elapsed;
  drill.status = 'restored';
  next.evidence.push({ id: `${command.id}-restore`, kind: 'restore', detail: `${command.checksum}:${String(elapsed)}`, immutable: true });
  return finish(next, command, 'recovery-snapshot-restored');
}

export function acceptRecoveryObjective(state: RecoveryDrillState, command: Meta) {
  assert(command.actor.role === 'Service Owner' && command.actor.id === state.service.ownerId, 'Assigned service owner must accept recovery results.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'restored' && typeof drill.elapsedMinutes === 'number', 'Completed recovery timing is required.');
  assertCurrent(next);
  assert(drill.elapsedMinutes <= next.service.recoveryObjectiveMinutes && next.sandbox.checksum === next.snapshot.checksum, 'Recovery result does not satisfy service objectives.');
  drill.status = 'owner-accepted';
  drill.serviceOwner = command.actor.id;
  next.evidence.push({ id: `${command.id}-owner`, kind: 'owner-acceptance', detail: String(drill.elapsedMinutes), immutable: true });
  return finish(next, command, 'recovery-objective-accepted');
}

export function verifyRecoverySecurity(state: RecoveryDrillState, command: Meta) {
  assert(command.actor.role === 'Security Auditor', 'Only security auditors can verify recovery security.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'owner-accepted' && command.actor.id !== drill.owner && command.actor.id !== drill.engineer, 'Independent owner-accepted recovery is required.');
  assertCurrent(next);
  assert(next.sandbox.networkAccess === 'none' && next.sandbox.status === 'restored', 'Isolated restored sandbox is required.');
  next.sandbox.status = 'verified';
  next.sandbox.version += 1;
  drill.sandboxVersion = next.sandbox.version;
  drill.status = 'security-verified';
  drill.auditor = command.actor.id;
  next.evidence.push({ id: `${command.id}-security`, kind: 'security-verification', detail: 'isolated:no-egress', immutable: true });
  return finish(next, command, 'recovery-security-verified');
}

export function closeRecoveryDrill(state: RecoveryDrillState, command: Meta) {
  assert(command.actor.role === 'Change Manager', 'Only change managers can close recovery drills.');
  const next = begin(state, command), drill = current(next);
  assert(drill.status === 'security-verified' && next.sandbox.status === 'verified', 'Security-verified recovery drill is required.');
  assertCurrent(next);
  next.sandbox.status = 'destroyed';
  delete next.sandbox.checksum;
  next.sandbox.version += 1;
  drill.sandboxVersion = next.sandbox.version;
  drill.status = 'closed';
  next.evidence.push({ id: `${command.id}-closure`, kind: 'closure', detail: next.sandbox.id, immutable: true });
  return finish(next, command, 'recovery-drill-closed');
}

export class RecoveryDrillRepository {
  static key = 'sentinelarc:recovery-drill:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(RecoveryDrillRepository.key); return raw ? JSON.parse(raw) as RecoveryDrillState : structuredClone(initialRecoveryDrillState); }
  commit(expectedRevision: number, operation: (state: RecoveryDrillState) => RecoveryDrillState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed recovery drill. Refresh before retrying.'); const next = operation(state); this.storage.setItem(RecoveryDrillRepository.key, JSON.stringify(next)); return next; }
}
