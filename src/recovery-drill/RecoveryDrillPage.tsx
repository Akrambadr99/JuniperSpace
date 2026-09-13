import { useRef, useState } from 'react';
import { acceptRecoveryObjective, closeRecoveryDrill, isolateRecoverySandbox, planRecoveryDrill, RecoveryDrillRepository, restoreRecoverySnapshot, validateRecoverySnapshot, verifyRecoverySecurity, type RecoveryDrillState, type RecoveryRole } from './recovery-drill';

const actors: Record<RecoveryRole, string> = { 'Continuity Manager': 'continuity', 'Backup Operator': 'backup-operator', 'Platform Engineer': 'platform-engineer', 'Service Owner': 'service-owner', 'Security Auditor': 'security-auditor', 'Change Manager': 'change-manager' };

export function RecoveryDrillPage() {
  const [repository] = useState(() => new RecoveryDrillRepository(localStorage));
  const [state, setState] = useState<RecoveryDrillState>(() => repository.read());
  const [role, setRole] = useState<RecoveryRole>('Continuity Manager');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: RecoveryDrillState) => RecoveryDrillState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery drill action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page">
    <header className="page-title"><p>Service continuity</p><h1>Recovery drill</h1><p>Restore sealed evidence in isolation and verify recovery objectives without changing production.</p></header>
    <section className="workspace-toolbar"><label>Recovery role<select value={role} onChange={(event) => { setRole(event.target.value as RecoveryRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setState(repository.read()); setMessage('Recovery drill refreshed.'); }}>Refresh recovery drill</button></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="card">
      <h2>{state.service.id} · {state.drill?.status ?? 'not planned'}</h2>
      <p>Production {state.service.status} v{state.service.version} · objective {state.service.recoveryObjectiveMinutes} minutes</p>
      <p>Snapshot {state.snapshot.status} v{state.snapshot.version} · sandbox {state.sandbox.status} v{state.sandbox.version}</p>
      <p>Elapsed {state.drill?.elapsedMinutes ?? 0} minutes · immutable evidence {state.evidence.length}</p>
      <button disabled={role !== 'Continuity Manager' || Boolean(state.drill)} onClick={() => { run((value) => planRecoveryDrill(value, { ...meta(), startedAt: '2026-09-13T08:00:00Z' }), 'Recovery drill planned.'); }}>Plan recovery drill</button>
      <button disabled={role !== 'Backup Operator' || state.drill?.status !== 'planned'} onClick={() => { run((value) => validateRecoverySnapshot(value, { ...meta(), observedChecksum: 'snap-a18b29c3' }), 'Recovery snapshot validated.'); }}>Validate recovery snapshot</button>
      <button disabled={role !== 'Platform Engineer' || state.drill?.status !== 'snapshot-validated'} onClick={() => { run((value) => isolateRecoverySandbox(value, meta()), 'Recovery sandbox isolated.'); }}>Isolate recovery sandbox</button>
      <button disabled={role !== 'Backup Operator' || state.drill?.status !== 'sandbox-isolated'} onClick={() => { run((value) => restoreRecoverySnapshot(value, { ...meta(), restoredAt: '2026-09-13T08:42:00Z', checksum: 'snap-a18b29c3' }), 'Recovery snapshot restored.'); }}>Restore recovery snapshot</button>
      <button disabled={role !== 'Service Owner' || state.drill?.status !== 'restored'} onClick={() => { run((value) => acceptRecoveryObjective(value, meta()), 'Recovery objective accepted.'); }}>Accept recovery objective</button>
      <button disabled={role !== 'Security Auditor' || state.drill?.status !== 'owner-accepted'} onClick={() => { run((value) => verifyRecoverySecurity(value, meta()), 'Recovery security verified.'); }}>Verify recovery security</button>
      <button disabled={role !== 'Change Manager' || state.drill?.status !== 'security-verified'} onClick={() => { run((value) => closeRecoveryDrill(value, meta()), 'Recovery drill closed.'); }}>Close recovery drill</button>
    </section>
    <section className="card" aria-label="Recovery drill history"><h2>Recovery history</h2>{state.evidence.map((entry) => <p key={entry.id}>{entry.kind} · {entry.detail}</p>)}</section>
  </main>;
}
