import { useRef, useState } from 'react';
import { approveContainment, closeInvestigation, executeContainment, InvestigationRepository, openInvestigation, refreshRemediationTelemetry, sealInvestigationEvidence, verifyRemediation, type InvestigationRole, type InvestigationState } from './investigation-dossier';
const actorIds: Record<InvestigationRole, string> = { 'SOC Analyst': 'analyst', 'Evidence Custodian': 'custodian', 'Incident Commander': 'commander', 'Security Engineer': 'engineer', Auditor: 'auditor' };

export function InvestigationDossierPage() {
  const [repository] = useState(() => new InvestigationRepository(localStorage));
  const [state, setState] = useState<InvestigationState>(() => repository.read());
  const [role, setRole] = useState<InvestigationRole>('SOC Analyst');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const command = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actorIds[role], role } });
  const run = (change: (value: InvestigationState) => InvestigationState, success: string) => {
    try { setState(repository.commit(state.revision, change)); setMessage(success); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Investigation action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };

  return <main className="page">
    <header className="page-title"><p>Incident assurance</p><h1>Investigation closure dossier</h1><p>Alert evidence, custody integrity, containment, fresh telemetry and independent closure form one audit trail.</p></header>
    <section className="workspace-toolbar"><label>Investigation role<select value={role} onChange={(event) => { setRole(event.target.value as InvestigationRole); }}>{Object.keys(actorIds).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setState(repository.read()); }}>Refresh investigation</button></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <div className="cards">
      <section className="card"><h2>Alert {state.alert.id}</h2><p>{state.alert.status} · identity {state.identity.status} · dossier {state.dossier?.status ?? 'none'}</p><p>Evidence {state.evidence.status} · {state.evidence.checksum}</p>
        <button disabled={role !== 'SOC Analyst' || Boolean(state.dossier)} onClick={() => { run((value) => openInvestigation(value, command()), 'Investigation opened.'); }}>Open critical investigation</button>
        <button disabled={role !== 'Evidence Custodian' || state.dossier?.status !== 'opened'} onClick={() => { run((value) => sealInvestigationEvidence(value, { ...command(), checksum: state.evidence.checksum }), 'Investigation evidence sealed.'); }}>Seal investigation evidence</button>
        <button disabled={role !== 'Incident Commander' || state.dossier?.status !== 'evidence-accepted'} onClick={() => { run((value) => approveContainment(value, { ...command(), actions: ['revoke-sessions', 'rotate-credential'], rationale: 'Critical identity activity requires immediate session and credential containment.' }), 'Containment approved.'); }}>Approve containment plan</button>
        <button disabled={role !== 'Security Engineer' || state.dossier?.status !== 'containment-approved'} onClick={() => { run((value) => executeContainment(value, command()), 'Containment executed.'); }}>Execute identity containment</button>
      </section>
      <section className="card"><h2>Remediation verification</h2><p>Telemetry {state.telemetry.fresh ? 'fresh' : 'stale'} · sessions {state.telemetry.activeSessions} · malicious hits {state.telemetry.maliciousHits}</p>
        <button disabled={role !== 'Security Engineer' || state.dossier?.status !== 'contained'} onClick={() => { run((value) => refreshRemediationTelemetry(value, { ...command(), activeSessions: 0, maliciousHits: 0 }), 'Remediation telemetry refreshed.'); }}>Refresh remediation telemetry</button>
        <button disabled={role !== 'Auditor' || state.dossier?.status !== 'contained' || !state.telemetry.fresh} onClick={() => { run((value) => verifyRemediation(value, { ...command(), rationale: 'Fresh telemetry confirms revoked sessions and zero malicious activity.' }), 'Remediation independently verified.'); }}>Verify remediation evidence</button>
        <button disabled={role !== 'Incident Commander' || state.dossier?.status !== 'verified'} onClick={() => { run((value) => closeInvestigation(value, command()), 'Investigation closed.'); }}>Close verified investigation</button>
      </section>
    </div>
    <section aria-label="Investigation dossier history"><h2>Investigation dossier history</h2><ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol></section>
  </main>;
}
