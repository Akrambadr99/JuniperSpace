export type CorrelationRole = 'SOC Analyst' | 'Threat Intel Analyst' | 'Incident Commander' | 'Endpoint Operator' | 'Security Auditor';
export type AlertFilter = 'all' | 'critical' | 'unassigned';
export interface SecurityAlert {
  id: string;
  version: number;
  severity: 'critical' | 'medium';
  campaign: string;
  assetId: string;
  status: 'open' | 'correlated' | 'contained' | 'closed';
  owner: string | null;
}
export interface AlertCorrelationState {
  revision: number;
  queueVersion: number;
  telemetryFeedVersion: number;
  filter: AlertFilter;
  selectedIds: string[];
  alerts: SecurityAlert[];
  assets: { id: string; version: number; status: 'online' | 'isolated'; activeSessions: number }[];
  incident: null | { id: string; version: number; status: 'correlated' | 'assigned' | 'contained' | 'verified' | 'closed'; alertIds: string[]; assetIds: string[]; campaign: string; owner: string | null; telemetryFeedVersion: number; assetVersions: Record<string, number> };
  evidence: { id: string; kind: 'telemetry-refresh' | 'correlation' | 'containment' | 'verification' | 'closure'; reference: string; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}

export const initialAlertCorrelationState: AlertCorrelationState = {
  revision: 0,
  queueVersion: 12,
  telemetryFeedVersion: 7,
  filter: 'all',
  selectedIds: [],
  alerts: [
    { id: 'ALERT-901', version: 4, severity: 'critical', campaign: 'EMBER-FROST', assetId: 'HOST-21', status: 'open', owner: null },
    { id: 'ALERT-902', version: 3, severity: 'critical', campaign: 'EMBER-FROST', assetId: 'HOST-22', status: 'open', owner: null },
    { id: 'ALERT-903', version: 6, severity: 'medium', campaign: 'ROUTINE-SCAN', assetId: 'HOST-23', status: 'open', owner: null },
  ],
  assets: [
    { id: 'HOST-21', version: 5, status: 'online', activeSessions: 2 },
    { id: 'HOST-22', version: 8, status: 'online', activeSessions: 1 },
    { id: 'HOST-23', version: 3, status: 'online', activeSessions: 0 },
  ],
  incident: null,
  evidence: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: CorrelationRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: AlertCorrelationState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Alert queue changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Alert correlation command already applied.');
  return structuredClone(state);
}
function finish(state: AlertCorrelationState, command: Meta, action: string) {
  state.revision += 1;
  state.queueVersion += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}
export function visibleAlerts(state: AlertCorrelationState) {
  if (state.filter === 'critical') return state.alerts.filter((alert) => alert.severity === 'critical' && alert.status === 'open');
  if (state.filter === 'unassigned') return state.alerts.filter((alert) => !alert.owner && alert.status === 'open');
  return state.alerts;
}
function selectedAlerts(state: AlertCorrelationState) {
  assert(state.selectedIds.length >= 2, 'Select at least two alerts to correlate.');
  const selected = state.selectedIds.map((id) => state.alerts.find((alert) => alert.id === id));
  assert(selected.every((alert) => alert), 'A selected alert no longer exists.');
  return selected as SecurityAlert[];
}

export function changeAlertFilter(state: AlertCorrelationState, command: Meta & { filter: AlertFilter }) {
  const next = begin(state, command);
  next.filter = command.filter;
  const visibleIds = new Set(visibleAlerts(next).map((alert) => alert.id));
  next.selectedIds = next.selectedIds.filter((id) => visibleIds.has(id));
  return finish(next, command, 'alert-filter-changed');
}

export function toggleAlertSelection(state: AlertCorrelationState, command: Meta & { alertId: string }) {
  assert(command.actor.role === 'SOC Analyst', 'Only SOC analysts can select alerts for correlation.');
  const next = begin(state, command);
  assert(visibleAlerts(next).some((alert) => alert.id === command.alertId), 'Only visible alerts can be selected.');
  next.selectedIds = next.selectedIds.includes(command.alertId)
    ? next.selectedIds.filter((id) => id !== command.alertId)
    : [...next.selectedIds, command.alertId];
  return finish(next, command, 'alert-selection-changed');
}

export function applyAlertTelemetryRefresh(
  state: AlertCorrelationState,
  command: Meta & { responseVersion: number; capturedQueueVersion: number; activeSessions: Record<string, number>; assetVersions: Record<string, number> },
) {
  assert(command.actor.role === 'Threat Intel Analyst', 'Only threat-intelligence analysts can refresh alert telemetry.');
  const next = begin(state, command);
  assert(command.capturedQueueVersion === state.queueVersion, 'Alert queue changed while telemetry was loading. Retry refresh.');
  assert(command.responseVersion > next.telemetryFeedVersion, 'Stale alert telemetry response ignored.');
  for (const asset of next.assets) {
    assert(command.assetVersions[asset.id] === asset.version, `Asset ${asset.id} changed before telemetry refresh.`);
    const sessions = command.activeSessions[asset.id];
    assert(typeof sessions === 'number' && sessions >= 0, `Telemetry is missing for ${asset.id}.`);
    asset.activeSessions = sessions;
  }
  next.telemetryFeedVersion = command.responseVersion;
  next.evidence.push({ id: `${command.id}-refresh`, kind: 'telemetry-refresh', reference: `feed-${String(command.responseVersion)}`, immutable: true });
  return finish(next, command, 'alert-telemetry-refreshed');
}

export function correlateSelectedAlerts(
  state: AlertCorrelationState,
  command: Meta & { expectedAlertVersions: Record<string, number> },
) {
  assert(command.actor.role === 'SOC Analyst', 'Only SOC analysts can correlate security alerts.');
  const next = begin(state, command), selected = selectedAlerts(next);
  assert(!next.incident && selected.every((alert) => alert.status === 'open'), 'Open alerts without an existing incident are required.');
  const campaigns = new Set(selected.map((alert) => alert.campaign));
  assert(campaigns.size === 1 && selected.every((alert) => alert.severity === 'critical'), 'Selected alerts must share one critical campaign.');
  for (const alert of selected) assert(command.expectedAlertVersions[alert.id] === alert.version, `Alert ${alert.id} changed before correlation.`);
  const campaign = selected[0]?.campaign;
  assert(campaign, 'Selected alert campaign is missing.');
  for (const alert of selected) { alert.status = 'correlated'; alert.version += 1; }
  const assetIds = selected.map((alert) => alert.assetId);
  next.incident = { id: 'INCIDENT-EMBER-91', version: 1, status: 'correlated', alertIds: selected.map((alert) => alert.id), assetIds, campaign, owner: null, telemetryFeedVersion: next.telemetryFeedVersion, assetVersions: Object.fromEntries(next.assets.filter((asset) => assetIds.includes(asset.id)).map((asset) => [asset.id, asset.version])) };
  next.evidence.push({ id: `${command.id}-correlation`, kind: 'correlation', reference: `${campaign}:${selected.map((alert) => alert.id).join(',')}`, immutable: true });
  return finish(next, command, 'selected-alerts-correlated');
}

export function assignCorrelatedIncident(state: AlertCorrelationState, command: Meta) {
  assert(command.actor.role === 'Incident Commander', 'Only incident commanders can assign correlated incidents.');
  const next = begin(state, command);
  assert(next.incident?.status === 'correlated', 'A correlated incident is required.');
  next.incident.status = 'assigned';
  next.incident.owner = command.actor.id;
  next.incident.version += 1;
  for (const alert of next.alerts.filter((item) => next.incident?.alertIds.includes(item.id))) { alert.owner = command.actor.id; alert.version += 1; }
  return finish(next, command, 'correlated-incident-assigned');
}

export function containCorrelatedAssets(state: AlertCorrelationState, command: Meta) {
  assert(command.actor.role === 'Endpoint Operator', 'Only endpoint operators can contain correlated assets.');
  const next = begin(state, command);
  assert(next.incident?.status === 'assigned' && next.incident.owner, 'An owned correlated incident is required.');
  assert(next.incident.telemetryFeedVersion === next.telemetryFeedVersion, 'Incident telemetry became stale before containment.');
  for (const assetId of next.incident.assetIds) {
    const asset = next.assets.find((item) => item.id === assetId);
    assert(asset, `Asset ${assetId} no longer exists.`);
    assert(asset.version === next.incident.assetVersions[assetId], `Asset ${assetId} changed before containment.`);
    asset.status = 'isolated';
    asset.activeSessions = 0;
    asset.version += 1;
    next.incident.assetVersions[assetId] = asset.version;
  }
  for (const alert of next.alerts.filter((item) => next.incident?.alertIds.includes(item.id))) { alert.status = 'contained'; alert.version += 1; }
  next.incident.status = 'contained';
  next.incident.version += 1;
  next.evidence.push({ id: `${command.id}-containment`, kind: 'containment', reference: next.incident.assetIds.join(','), immutable: true });
  return finish(next, command, 'correlated-assets-contained');
}

export function verifyCorrelatedContainment(state: AlertCorrelationState, command: Meta & { observedFeedVersion: number }) {
  assert(command.actor.role === 'Security Auditor', 'Only security auditors can verify incident containment.');
  const next = begin(state, command);
  assert(next.incident?.status === 'contained' && command.actor.id !== next.incident.owner, 'Independent containment verification is required.');
  assert(command.observedFeedVersion === 9 && command.observedFeedVersion > next.incident.telemetryFeedVersion, 'Fresh post-containment telemetry is required.');
  assert(next.incident.assetIds.every((id) => next.assets.find((asset) => asset.id === id)?.status === 'isolated' && next.assets.find((asset) => asset.id === id)?.activeSessions === 0), 'Every correlated asset must be isolated with zero active sessions.');
  next.telemetryFeedVersion = command.observedFeedVersion;
  next.incident.telemetryFeedVersion = command.observedFeedVersion;
  next.incident.status = 'verified';
  next.incident.version += 1;
  next.evidence.push({ id: `${command.id}-verification`, kind: 'verification', reference: `feed-${String(command.observedFeedVersion)}:zero-sessions`, immutable: true });
  return finish(next, command, 'correlated-containment-verified');
}

export function closeCorrelatedIncident(state: AlertCorrelationState, command: Meta) {
  assert(command.actor.role === 'Incident Commander', 'Only incident commanders can close correlated incidents.');
  const next = begin(state, command);
  assert(next.incident?.status === 'verified' && next.incident.owner === command.actor.id, 'The owning commander requires verified containment before closure.');
  assert(next.evidence.length === 4, 'Telemetry, correlation, containment and verification evidence are required.');
  for (const alert of next.alerts.filter((item) => next.incident?.alertIds.includes(item.id))) { alert.status = 'closed'; alert.version += 1; }
  next.incident.status = 'closed';
  next.incident.version += 1;
  next.selectedIds = [];
  next.evidence.push({ id: `${command.id}-closure`, kind: 'closure', reference: next.incident.id, immutable: true });
  return finish(next, command, 'correlated-incident-closed');
}

export class AlertCorrelationRepository {
  static key = 'sentinelarc:alert-correlation:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(AlertCorrelationRepository.key); return raw ? JSON.parse(raw) as AlertCorrelationState : structuredClone(initialAlertCorrelationState); }
  commit(expectedRevision: number, operation: (state: AlertCorrelationState) => AlertCorrelationState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed alert correlation. Refresh before retrying.'); const next = operation(state); this.storage.setItem(AlertCorrelationRepository.key, JSON.stringify(next)); return next; }
}
