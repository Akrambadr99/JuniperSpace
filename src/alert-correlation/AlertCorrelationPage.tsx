import { useRef, useState } from 'react';
import { applyAlertTelemetryRefresh, AlertCorrelationRepository, assignCorrelatedIncident, changeAlertFilter, closeCorrelatedIncident, containCorrelatedAssets, correlateSelectedAlerts, toggleAlertSelection, verifyCorrelatedContainment, visibleAlerts, type AlertCorrelationState, type AlertFilter, type CorrelationRole } from './alert-correlation';
const actors: Record<CorrelationRole, string> = { 'SOC Analyst': 'analyst-a', 'Threat Intel Analyst': 'intel-a', 'Incident Commander': 'commander-a', 'Endpoint Operator': 'endpoint-a', 'Security Auditor': 'auditor-a' };
export function AlertCorrelationPage() {
  const [repository] = useState(() => new AlertCorrelationRepository(localStorage));
  const [state, setState] = useState<AlertCorrelationState>(() => repository.read());
  const [role, setRole] = useState<CorrelationRole>('SOC Analyst');
  const [message, setMessage] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: AlertCorrelationState) => AlertCorrelationState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); setFeedbackTone('success'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Alert correlation action failed.'); setFeedbackTone('error'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  const stages = ['correlated', 'assigned', 'contained', 'verified', 'closed'] as const;
  const stage = state.incident ? stages.indexOf(state.incident.status) + 1 : 0;
  return <main className="page">
    <header className="page-title"><p>Security operations</p><h1>Alert correlation queue</h1><p>Preserve critical selection through telemetry refresh and govern multi-asset containment.</p></header>
    <section className="workspace-toolbar">
      <label>Correlation role<select value={role} onChange={(event) => { setRole(event.target.value as CorrelationRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Alert filter<select value={state.filter} onChange={(event) => { const filter = event.target.value as AlertFilter; run((value) => changeAlertFilter(value, { ...meta(), filter }), `Alert filter changed to ${filter}.`); }}><option value="all">All alerts</option><option value="critical">Critical alerts</option><option value="unassigned">Unassigned alerts</option></select></label>
      <button disabled={role !== 'Threat Intel Analyst'} onClick={() => { const capturedQueueVersion = state.queueVersion; run((value) => applyAlertTelemetryRefresh(value, { ...meta(), responseVersion: 8, capturedQueueVersion, activeSessions: { 'HOST-21': 2, 'HOST-22': 1, 'HOST-23': 0 }, assetVersions: { 'HOST-21': 5, 'HOST-22': 8, 'HOST-23': 3 } }), 'Alert telemetry refreshed with selection preserved.'); }}>Refresh alert telemetry</button>
    </section>
    {message && <p ref={feedback} tabIndex={-1} role={feedbackTone === 'error' ? 'alert' : 'status'} className={`workflow-feedback ${feedbackTone}`}>{message}</p>}
    <div className="workflow-master-detail">
    <section className="suite-table-wrap workflow-queue" aria-label="Alert results"><table><caption>{visibleAlerts(state).length} visible alerts · {state.selectedIds.length} selected</caption><thead><tr><th>Select</th><th>Alert</th><th>Severity</th><th>Campaign</th><th>Asset</th><th>Status</th></tr></thead><tbody>{visibleAlerts(state).map((alert) => <tr key={alert.id}><td><input type="checkbox" aria-label={`Select ${alert.id}`} checked={state.selectedIds.includes(alert.id)} onChange={() => { run((value) => toggleAlertSelection(value, { ...meta(), alertId: alert.id }), `${alert.id} selection updated.`); }} /></td><td>{alert.id}</td><td>{alert.severity}</td><td>{alert.campaign}</td><td>{alert.assetId}</td><td>{alert.status}</td></tr>)}</tbody></table></section>
    <aside className="card workflow-detail" aria-label="Correlated incident"><h2>{state.incident?.id ?? 'Correlated incident'} · {state.incident?.status ?? 'not created'}</h2><p>Alerts {state.incident?.alertIds.length ?? 0} · assets {state.incident?.assetIds.length ?? 0} · owner {state.incident?.owner ?? 'unassigned'}</p><p>Telemetry feed {state.telemetryFeedVersion} · immutable evidence {state.evidence.length}</p><p>Isolated assets {state.assets.filter((asset) => asset.status === 'isolated').length} · active sessions {state.assets.reduce((total, asset) => total + asset.activeSessions, 0)}</p>
      <ol className="workflow-steps" aria-label="Incident response stages">{['Correlate alerts', 'Assign owner', 'Contain assets', 'Verify recovery', 'Close incident'].map((label, index) => <li key={label} data-complete={stage > index} aria-current={stage === index ? 'step' : undefined}>{label}</li>)}</ol>
      <div className="workflow-actions">
      <button disabled={role !== 'SOC Analyst' || state.selectedIds.length < 2 || Boolean(state.incident)} onClick={() => { const expectedAlertVersions = Object.fromEntries(state.alerts.filter((alert) => state.selectedIds.includes(alert.id)).map((alert) => [alert.id, alert.version])); run((value) => correlateSelectedAlerts(value, { ...meta(), expectedAlertVersions }), 'Selected critical alerts correlated.'); }}>Correlate selected alerts</button>
      <button disabled={role !== 'Incident Commander' || state.incident?.status !== 'correlated'} onClick={() => { run((value) => assignCorrelatedIncident(value, meta()), 'Correlated incident assigned.'); }}>Assign correlated incident</button>
      <button disabled={role !== 'Endpoint Operator' || state.incident?.status !== 'assigned'} onClick={() => { run((value) => containCorrelatedAssets(value, meta()), 'Correlated assets contained.'); }}>Contain correlated assets</button>
      <button disabled={role !== 'Security Auditor' || state.incident?.status !== 'contained'} onClick={() => { run((value) => verifyCorrelatedContainment(value, { ...meta(), observedFeedVersion: 9 }), 'Fresh correlated containment verified.'); }}>Verify correlated containment</button>
      <button disabled={role !== 'Incident Commander' || state.incident?.status !== 'verified'} onClick={() => { run((value) => closeCorrelatedIncident(value, meta()), 'Correlated incident closed.'); }}>Close correlated incident</button>
      </div>
    </aside>
    </div>
    <section className="card workflow-history" aria-label="Alert correlation history"><details><summary>Correlation history · {state.events.length} events</summary>{state.events.map((event) => <p key={event.id}>{event.action}</p>)}</details></section>
  </main>;
}
