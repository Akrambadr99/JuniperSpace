export type ExceptionRole = 'System Owner' | 'Security Architect' | 'Risk Officer' | 'Security Engineer' | 'SOC Analyst' | 'Auditor';

export interface SecurityExceptionState {
  revision: number;
  policy: { id: string; version: number; maximumDays: number; maximumResidualRisk: number };
  asset: { id: string; version: number; classification: 'restricted'; status: 'protected' | 'exception-active' };
  identity: { id: string; version: number; baselineScopes: string[]; activeScopes: string[] };
  control: { id: string; version: number; status: 'available' | 'configured' | 'active' | 'removed'; owner?: string };
  telemetry: { version: number; fresh: boolean; deniedEvents: number; privilegedSessions: number };
  exception: null | {
    id: string;
    status: 'draft' | 'assessed' | 'approved' | 'configured' | 'active' | 'verified' | 'expired' | 'revoked' | 'cancelled';
    owner: string;
    requestedScope: string;
    startsOn: string;
    expiresOn: string;
    policyVersion: number;
    assetVersion: number;
    identityVersion: number;
    controlVersion: number;
    telemetryVersion: number;
    residualRisk?: number;
    architect?: string;
    approver?: string;
    engineer?: string;
  };
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialSecurityExceptionState: SecurityExceptionState = {
  revision: 0,
  policy: { id: 'POL-ACCESS-4', version: 12, maximumDays: 14, maximumResidualRisk: 4 },
  asset: { id: 'PROD-LEDGER', version: 9, classification: 'restricted', status: 'protected' },
  identity: { id: 'IDENTITY-77', version: 6, baselineScopes: ['ledger:read'], activeScopes: ['ledger:read'] },
  control: { id: 'CONTROL-JIT-8', version: 4, status: 'available' },
  telemetry: { version: 21, fresh: true, deniedEvents: 0, privilegedSessions: 0 },
  exception: null,
  events: [],
};

interface CommandMeta {
  id: string;
  expectedRevision: number;
  actor: { id: string; role: ExceptionRole };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: SecurityExceptionState, command: CommandMeta) {
  assert(state.revision === command.expectedRevision, 'Security exception changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: SecurityExceptionState, command: CommandMeta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function currentException(state: SecurityExceptionState) {
  assert(state.exception, 'No security exception exists.');
  return state.exception;
}

function differenceInDays(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / 86_400_000;
}

function assertPinnedGovernance(state: SecurityExceptionState) {
  const current = currentException(state);
  assert(current.policyVersion === state.policy.version, 'Security policy changed after the request.');
  assert(current.assetVersion === state.asset.version, 'Protected asset changed after the request.');
  assert(current.identityVersion === state.identity.version, 'Identity access changed after the request.');
  assert(current.controlVersion === state.control.version, 'Compensating control changed after the request.');
}

export function draftSecurityException(
  state: SecurityExceptionState,
  command: CommandMeta & { scope: string; startsOn: string; expiresOn: string },
) {
  assert(command.actor.role === 'System Owner', 'Only system owners can draft security exceptions.');
  const next = begin(state, command);
  assert(!next.exception || ['expired', 'revoked', 'cancelled'].includes(next.exception.status), 'An active security exception already exists.');
  assert(/^ledger:[a-z-]+$/.test(command.scope) && !next.identity.baselineScopes.includes(command.scope), 'Requested scope must be a new ledger permission.');
  const duration = differenceInDays(command.startsOn, command.expiresOn);
  assert(Number.isInteger(duration) && duration > 0 && duration <= next.policy.maximumDays, 'Exception duration exceeds policy.');
  next.exception = {
    id: `${command.id}-exception`,
    status: 'draft',
    owner: command.actor.id,
    requestedScope: command.scope,
    startsOn: command.startsOn,
    expiresOn: command.expiresOn,
    policyVersion: next.policy.version,
    assetVersion: next.asset.version,
    identityVersion: next.identity.version,
    controlVersion: next.control.version,
    telemetryVersion: next.telemetry.version,
  };
  return finish(next, command, 'security-exception-drafted', command.scope);
}

export function assessCompensatingControl(
  state: SecurityExceptionState,
  command: CommandMeta & { residualRisk: number; rationale: string },
) {
  assert(command.actor.role === 'Security Architect', 'Only security architects can assess compensating controls.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(current.status === 'draft', 'Draft security exception is required.');
  assert(command.actor.id !== current.owner, 'Control assessment must be independent.');
  assert(Number.isInteger(command.residualRisk) && command.residualRisk >= 1 && command.residualRisk <= next.policy.maximumResidualRisk, 'Residual risk exceeds policy.');
  assert(command.rationale.trim().length >= 24, 'Control rationale must contain at least 24 characters.');
  assertPinnedGovernance(next);
  current.residualRisk = command.residualRisk;
  current.architect = command.actor.id;
  current.status = 'assessed';
  return finish(next, command, 'compensating-control-assessed', command.rationale.trim());
}

export function approveSecurityException(state: SecurityExceptionState, command: CommandMeta) {
  assert(command.actor.role === 'Risk Officer', 'Only risk officers can approve security exceptions.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(current.status === 'assessed' && current.residualRisk, 'Assessed residual risk is required.');
  assert(command.actor.id !== current.owner && command.actor.id !== current.architect, 'Risk approval must be independent.');
  assertPinnedGovernance(next);
  current.approver = command.actor.id;
  current.status = 'approved';
  return finish(next, command, 'security-exception-approved', String(current.residualRisk));
}

export function configureExceptionControl(state: SecurityExceptionState, command: CommandMeta) {
  assert(command.actor.role === 'Security Engineer', 'Only security engineers can configure exception controls.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(current.status === 'approved', 'Approved security exception is required.');
  assert(command.actor.id !== current.approver && command.actor.id !== current.architect, 'Control implementation must be independent.');
  assertPinnedGovernance(next);
  next.control.status = 'configured';
  next.control.owner = command.actor.id;
  next.control.version += 1;
  current.controlVersion = next.control.version;
  current.engineer = command.actor.id;
  current.status = 'configured';
  return finish(next, command, 'exception-control-configured', next.control.id);
}

export function activateSecurityException(state: SecurityExceptionState, command: CommandMeta & { asOf: string }) {
  assert(command.actor.role === 'Security Engineer', 'Only the implementing engineer can activate security exceptions.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(current.status === 'configured' && command.actor.id === current.engineer, 'Configured control owned by the engineer is required.');
  assert(command.asOf >= current.startsOn && command.asOf < current.expiresOn, 'Exception is outside its active date window.');
  assert(current.identityVersion === next.identity.version && current.assetVersion === next.asset.version, 'Identity or asset changed before activation.');
  next.control.status = 'active';
  next.control.version += 1;
  next.identity.activeScopes.push(current.requestedScope);
  next.identity.version += 1;
  next.asset.status = 'exception-active';
  next.asset.version += 1;
  next.telemetry.fresh = false;
  current.controlVersion = next.control.version;
  current.identityVersion = next.identity.version;
  current.assetVersion = next.asset.version;
  current.status = 'active';
  return finish(next, command, 'security-exception-activated', current.requestedScope);
}

export function refreshExceptionTelemetry(
  state: SecurityExceptionState,
  command: CommandMeta & { deniedEvents: number; privilegedSessions: number },
) {
  assert(command.actor.role === 'SOC Analyst', 'Only SOC analysts can refresh exception telemetry.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(['active', 'verified'].includes(current.status), 'Active security exception is required.');
  assert(Number.isInteger(command.deniedEvents) && command.deniedEvents >= 0, 'Denied event count is invalid.');
  assert(Number.isInteger(command.privilegedSessions) && command.privilegedSessions >= 0, 'Session count is invalid.');
  next.telemetry.version += 1;
  next.telemetry.fresh = true;
  next.telemetry.deniedEvents = command.deniedEvents;
  next.telemetry.privilegedSessions = command.privilegedSessions;
  current.telemetryVersion = next.telemetry.version;
  return finish(next, command, 'exception-telemetry-refreshed', `${String(command.privilegedSessions)} sessions`);
}

export function verifyActiveException(state: SecurityExceptionState, command: CommandMeta) {
  assert(command.actor.role === 'Auditor', 'Only auditors can verify active exceptions.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(current.status === 'active' && next.telemetry.fresh, 'Active exception with fresh telemetry is required.');
  assert(next.telemetry.deniedEvents === 0, 'Denied activity requires investigation before verification.');
  assert(command.actor.id !== current.approver && command.actor.id !== current.engineer, 'Exception verification must be independent.');
  current.status = 'verified';
  return finish(next, command, 'active-exception-verified', current.id);
}

export function expireSecurityException(state: SecurityExceptionState, command: CommandMeta & { asOf: string }) {
  assert(command.actor.role === 'Security Engineer', 'Only security engineers can expire exceptions.');
  const next = begin(state, command);
  const current = currentException(next);
  assert(['active', 'verified'].includes(current.status), 'Active or verified exception is required.');
  assert(command.asOf >= current.expiresOn, 'Exception cannot expire before its approved end date.');
  assert(next.identity.activeScopes.includes(current.requestedScope), 'Exception scope is no longer active.');
  next.identity.activeScopes = next.identity.activeScopes.filter((scope) => scope !== current.requestedScope);
  next.identity.version += 1;
  next.control.status = 'removed';
  next.control.version += 1;
  next.asset.status = 'protected';
  next.asset.version += 1;
  current.status = 'expired';
  return finish(next, command, 'security-exception-expired', current.requestedScope);
}

export class SecurityExceptionRepository {
  static key = 'sentinelarc:security-exceptions:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(SecurityExceptionRepository.key); return raw ? JSON.parse(raw) as SecurityExceptionState : structuredClone(initialSecurityExceptionState); }
  commit(expectedRevision: number, operation: (state: SecurityExceptionState) => SecurityExceptionState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed security exceptions. Refresh before retrying.'); const next = operation(current); this.storage.setItem(SecurityExceptionRepository.key, JSON.stringify(next)); return next; }
}
