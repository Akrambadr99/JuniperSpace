export type CertificationRole = 'Review Coordinator' | 'Resource Owner' | 'Security Approver' | 'Identity Operator';

export interface AccessCertificationState {
  revision: number;
  policy: { id: string; version: number; maximumDormantDays: number };
  accounts: {
    id: string;
    ownerId: string;
    resource: string;
    privilege: 'admin' | 'deploy' | 'read';
    lastUsedDaysAgo: number;
    version: number;
    status: 'active' | 'revoked';
  }[];
  review: null | {
    id: string;
    status: 'draft' | 'decided' | 'approved' | 'applied';
    policyVersion: number;
    accountVersions: Record<string, number>;
    coordinator: string;
    ownerId: string;
    decisions: Record<string, 'retain' | 'revoke'>;
    approver?: string;
  };
  evidence: { id: string; reviewId: string; accountId: string; decision: string; actor: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialAccessCertificationState: AccessCertificationState = {
  revision: 0,
  policy: { id: 'POL-PRIV-90', version: 6, maximumDormantDays: 45 },
  accounts: [
    { id: 'ACC-DEPLOY', ownerId: 'owner-platform', resource: 'Production deploy', privilege: 'deploy', lastUsedDaysAgo: 8, version: 4, status: 'active' },
    { id: 'ACC-LEGACY', ownerId: 'owner-platform', resource: 'Legacy admin', privilege: 'admin', lastUsedDaysAgo: 92, version: 7, status: 'active' },
    { id: 'ACC-REPORT', ownerId: 'owner-finance', resource: 'Finance reports', privilege: 'read', lastUsedDaysAgo: 3, version: 5, status: 'active' },
  ],
  review: null,
  evidence: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: CertificationRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: AccessCertificationState, command: Meta) { assert(state.revision === command.expectedRevision, 'Access certification changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: AccessCertificationState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentReview(state: AccessCertificationState) { assert(state.review, 'No access certification exists.'); return state.review; }
function reviewedAccounts(state: AccessCertificationState) { const review = currentReview(state); return state.accounts.filter((account) => account.ownerId === review.ownerId && account.status === 'active'); }
function assertSnapshotCurrent(state: AccessCertificationState) { const review = currentReview(state); assert(review.policyVersion === state.policy.version, 'Access policy changed after review creation.'); for (const account of reviewedAccounts(state)) assert(review.accountVersions[account.id] === account.version, `${account.id} changed after review creation.`); }

export function openCertification(state: AccessCertificationState, command: Meta & { ownerId: string }) {
  assert(command.actor.role === 'Review Coordinator', 'Only review coordinators can open certifications.');
  const next = begin(state, command);
  assert(!next.review, 'An active access certification already exists.');
  const accounts = next.accounts.filter((account) => account.ownerId === command.ownerId && account.status === 'active');
  assert(accounts.length > 0, 'Resource owner has no active access to certify.');
  next.review = { id: `${command.id}-review`, status: 'draft', policyVersion: next.policy.version, accountVersions: Object.fromEntries(accounts.map((account) => [account.id, account.version])), coordinator: command.actor.id, ownerId: command.ownerId, decisions: {} };
  return finish(next, command, 'access-certification-opened', command.ownerId);
}

export function recordOwnerDecisions(state: AccessCertificationState, command: Meta & { decisions: Record<string, 'retain' | 'revoke'> }) {
  assert(command.actor.role === 'Resource Owner', 'Only resource owners can certify their access.');
  const next = begin(state, command), review = currentReview(next);
  assert(review.status === 'draft' && command.actor.id === review.ownerId, 'Assigned resource owner is required.');
  assertSnapshotCurrent(next);
  const accounts = reviewedAccounts(next);
  assert(accounts.every((account) => command.decisions[account.id]), 'Every active entitlement requires a decision.');
  assert(Object.keys(command.decisions).every((id) => accounts.some((account) => account.id === id)), 'Decision contains an account outside this review.');
  for (const account of accounts) {
    const decision = command.decisions[account.id];
    assert(decision, 'Account decision is missing.');
    if (account.lastUsedDaysAgo > next.policy.maximumDormantDays) assert(decision === 'revoke', 'Dormant privileged access must be revoked.');
    review.decisions[account.id] = decision;
    next.evidence.push({ id: `${command.id}-${account.id}`, reviewId: review.id, accountId: account.id, decision, actor: command.actor.id, immutable: true });
  }
  review.status = 'decided';
  return finish(next, command, 'owner-access-decisions-recorded', String(accounts.length));
}

export function approveCertification(state: AccessCertificationState, command: Meta) {
  assert(command.actor.role === 'Security Approver', 'Only security approvers can approve certifications.');
  const next = begin(state, command), review = currentReview(next);
  assert(review.status === 'decided', 'Completed owner decisions are required.');
  assert(command.actor.id !== review.coordinator && command.actor.id !== review.ownerId, 'Security approval must be independent.');
  assertSnapshotCurrent(next);
  review.status = 'approved'; review.approver = command.actor.id;
  return finish(next, command, 'access-certification-approved', review.id);
}

export function applyCertification(state: AccessCertificationState, command: Meta) {
  assert(command.actor.role === 'Identity Operator', 'Only identity operators can apply certifications.');
  const next = begin(state, command), review = currentReview(next);
  assert(review.status === 'approved', 'Approved access certification is required.');
  assertSnapshotCurrent(next);
  let revoked = 0;
  for (const account of reviewedAccounts(next)) {
    const decision = review.decisions[account.id];
    assert(decision, 'Approved review has an incomplete decision set.');
    if (decision === 'revoke') { account.status = 'revoked'; revoked += 1; }
    account.version += 1;
    review.accountVersions[account.id] = account.version;
  }
  review.status = 'applied';
  return finish(next, command, 'access-certification-applied', String(revoked));
}

export class AccessCertificationRepository {
  static key = 'sentinelarc:access-certification:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(AccessCertificationRepository.key); return raw ? JSON.parse(raw) as AccessCertificationState : structuredClone(initialAccessCertificationState); }
  commit(expectedRevision: number, operation: (state: AccessCertificationState) => AccessCertificationState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed certification. Refresh before retrying.'); const next = operation(current); this.storage.setItem(AccessCertificationRepository.key, JSON.stringify(next)); return next; }
}
