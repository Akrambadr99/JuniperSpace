export type LegalHoldRole = 'Investigator' | 'Legal Counsel' | 'Records Custodian' | 'Security Auditor' | 'Case Owner';

export interface LegalHoldState {
  revision: number;
  matter: { id: string; version: number; status: 'investigating' | 'hold-active' | 'closed'; owner: string };
  retentionPolicy: { id: string; version: number; status: 'active' | 'suspended'; deleteAfterDays: number };
  records: { id: string; version: number; classification: 'restricted'; status: 'retained' | 'preserved'; hash: string | null }[];
  hold: null | { id: string; status: 'scoped' | 'approved' | 'preserved' | 'verified' | 'release-requested' | 'released'; scope: string[]; requester: string; counsel: string | null; matterVersion: number; policyVersion: number; recordVersions: Record<string, number> };
  custody: { id: string; recordId: string; hash: string; custodian: string; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}

export const initialLegalHoldState: LegalHoldState = {
  revision: 0,
  matter: { id: 'MATTER-77', version: 4, status: 'investigating', owner: 'owner-a' },
  retentionPolicy: { id: 'RET-SEC-90', version: 3, status: 'active', deleteAfterDays: 90 },
  records: [
    { id: 'ALERT-778', version: 2, classification: 'restricted', status: 'retained', hash: null },
    { id: 'LOGIN-991', version: 5, classification: 'restricted', status: 'retained', hash: null },
    { id: 'IMAGE-204', version: 1, classification: 'restricted', status: 'retained', hash: null },
  ],
  hold: null,
  custody: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: LegalHoldRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: LegalHoldState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Legal hold changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Legal hold command already applied.');
  return structuredClone(state);
}
function current(state: LegalHoldState) { assert(state.hold, 'No legal hold exists.'); return state.hold; }
function versions(state: LegalHoldState) { return Object.fromEntries(state.records.map((record) => [record.id, record.version])); }
function assertCurrent(state: LegalHoldState) {
  const hold = current(state);
  assert(hold.matterVersion === state.matter.version, 'Investigation matter changed after hold processing began.');
  assert(hold.policyVersion === state.retentionPolicy.version, 'Retention policy changed after hold processing began.');
  for (const record of state.records) assert(hold.recordVersions[record.id] === record.version, `Held record ${record.id} changed after hold processing began.`);
}
function sync(state: LegalHoldState) { const hold = current(state); hold.matterVersion = state.matter.version; hold.policyVersion = state.retentionPolicy.version; hold.recordVersions = versions(state); }
function finish(state: LegalHoldState, command: Meta, action: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true }); return state; }

export function scopeLegalHold(state: LegalHoldState, command: Meta & { recordIds: string[] }) {
  assert(command.actor.role === 'Investigator', 'Only investigators can scope legal holds.');
  const next = begin(state, command);
  assert(!next.hold && next.matter.status === 'investigating', 'An investigating matter without an existing hold is required.');
  assert(command.recordIds.length === next.records.length && next.records.every((record) => command.recordIds.includes(record.id)), 'The legal hold must cover every seeded matter record.');
  next.retentionPolicy.status = 'suspended'; next.retentionPolicy.version += 1;
  next.matter.status = 'hold-active'; next.matter.version += 1;
  next.hold = { id: 'HOLD-77', status: 'scoped', scope: [...command.recordIds], requester: command.actor.id, counsel: null, matterVersion: next.matter.version, policyVersion: next.retentionPolicy.version, recordVersions: versions(next) };
  return finish(next, command, 'legal-hold-scoped');
}

export function approveLegalHold(state: LegalHoldState, command: Meta) {
  assert(command.actor.role === 'Legal Counsel', 'Only legal counsel can approve legal holds.');
  const next = begin(state, command), hold = current(next);
  assert(hold.status === 'scoped', 'A scoped legal hold is required.');
  assert(command.actor.id !== hold.requester, 'Legal hold approval must be independent of its request.');
  assertCurrent(next); hold.status = 'approved'; hold.counsel = command.actor.id;
  return finish(next, command, 'legal-hold-approved');
}

export function preserveHeldRecords(state: LegalHoldState, command: Meta & { hashes: Record<string, string> }) {
  assert(command.actor.role === 'Records Custodian', 'Only records custodians can preserve held records.');
  const next = begin(state, command), hold = current(next);
  assert(hold.status === 'approved', 'An approved legal hold is required.'); assertCurrent(next);
  for (const record of next.records) {
    const hash = command.hashes[record.id];
    assert(typeof hash === 'string' && hash.startsWith('sha256:'), `A verified hash is required for ${record.id}.`);
    record.status = 'preserved'; record.hash = hash; record.version += 1;
    next.custody.push({ id: `${command.id}-${record.id}`, recordId: record.id, hash, custodian: command.actor.id, immutable: true });
  }
  hold.status = 'preserved'; sync(next);
  return finish(next, command, 'held-records-preserved');
}

export function verifyLegalHoldCoverage(state: LegalHoldState, command: Meta) {
  assert(command.actor.role === 'Security Auditor', 'Only security auditors can verify legal holds.');
  const next = begin(state, command), hold = current(next);
  assert(hold.status === 'preserved', 'Preserved hold records are required.'); assertCurrent(next);
  assert(next.records.every((record) => record.status === 'preserved' && record.hash) && next.custody.length === hold.scope.length, 'Every scoped record requires immutable custody evidence.');
  hold.status = 'verified';
  return finish(next, command, 'legal-hold-coverage-verified');
}

export function requestLegalHoldRelease(state: LegalHoldState, command: Meta) {
  assert(command.actor.role === 'Case Owner' && command.actor.id === state.matter.owner, 'Only the matter owner can request hold release.');
  const next = begin(state, command), hold = current(next);
  assert(hold.status === 'verified', 'A verified legal hold is required.'); assertCurrent(next);
  next.matter.status = 'closed'; next.matter.version += 1; hold.status = 'release-requested'; sync(next);
  return finish(next, command, 'legal-hold-release-requested');
}

export function releaseLegalHold(state: LegalHoldState, command: Meta) {
  assert(command.actor.role === 'Legal Counsel', 'Only legal counsel can release legal holds.');
  const next = begin(state, command), hold = current(next);
  assert(hold.status === 'release-requested' && next.matter.status === 'closed', 'A closed matter with a release request is required.');
  assert(command.actor.id === hold.counsel && command.actor.id !== next.matter.owner, 'The approving counsel must independently release the hold.'); assertCurrent(next);
  next.retentionPolicy.status = 'active'; next.retentionPolicy.version += 1; hold.status = 'released'; sync(next);
  return finish(next, command, 'legal-hold-released');
}

export class LegalHoldRepository {
  static key = 'sentinelarc:legal-hold:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(LegalHoldRepository.key); return raw ? JSON.parse(raw) as LegalHoldState : structuredClone(initialLegalHoldState); }
  commit(expectedRevision: number, operation: (state: LegalHoldState) => LegalHoldState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed the legal hold. Refresh before retrying.'); const next = operation(state); this.storage.setItem(LegalHoldRepository.key, JSON.stringify(next)); return next; }
}
