import { describe, expect, it } from 'vitest';
import { acceptRecoveryObjective, closeRecoveryDrill, initialRecoveryDrillState, isolateRecoverySandbox, planRecoveryDrill, restoreRecoverySnapshot, validateRecoverySnapshot, verifyRecoverySecurity, type RecoveryRole } from './recovery-drill';

const meta = (id: string, revision: number, actor: string, role: RecoveryRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });

function restored() {
  let state = planRecoveryDrill(initialRecoveryDrillState, { ...meta('plan', 0, 'continuity', 'Continuity Manager'), startedAt: '2026-09-13T08:00:00Z' });
  state = validateRecoverySnapshot(state, { ...meta('validate', 1, 'backup', 'Backup Operator'), observedChecksum: 'snap-a18b29c3' });
  state = isolateRecoverySandbox(state, meta('isolate', 2, 'engineer', 'Platform Engineer'));
  return restoreRecoverySnapshot(state, { ...meta('restore', 3, 'backup', 'Backup Operator'), restoredAt: '2026-09-13T08:42:00Z', checksum: 'snap-a18b29c3' });
}

describe('recovery drills', () => {
  it('verifies and destroys the isolated recovery sandbox while production remains online', () => {
    let state = acceptRecoveryObjective(restored(), meta('accept', 4, 'service-owner', 'Service Owner'));
    state = verifyRecoverySecurity(state, meta('verify', 5, 'auditor', 'Security Auditor'));
    state = closeRecoveryDrill(state, meta('close', 6, 'change', 'Change Manager'));
    expect(state.drill).toMatchObject({ status: 'closed', elapsedMinutes: 42 });
    expect(state.sandbox.status).toBe('destroyed');
    expect(state.service).toMatchObject({ status: 'online', version: 14 });
    expect(state.evidence).toHaveLength(6);
  });

  it('rejects restoration beyond the service objective', () => {
    let state = planRecoveryDrill(initialRecoveryDrillState, { ...meta('plan', 0, 'continuity', 'Continuity Manager'), startedAt: '2026-09-13T08:00:00Z' });
    state = validateRecoverySnapshot(state, { ...meta('validate', 1, 'backup', 'Backup Operator'), observedChecksum: 'snap-a18b29c3' });
    state = isolateRecoverySandbox(state, meta('isolate', 2, 'engineer', 'Platform Engineer'));
    expect(() => restoreRecoverySnapshot(state, { ...meta('restore', 3, 'backup', 'Backup Operator'), restoredAt: '2026-09-13T09:05:00Z', checksum: 'snap-a18b29c3' })).toThrow('recovery objective');
  });

  it('protects snapshot validation from changed backup provenance', () => {
    const state = planRecoveryDrill(initialRecoveryDrillState, { ...meta('plan', 0, 'continuity', 'Continuity Manager'), startedAt: '2026-09-13T08:00:00Z' });
    state.snapshot.version += 1;
    expect(() => validateRecoverySnapshot(state, { ...meta('validate', 1, 'backup', 'Backup Operator'), observedChecksum: 'snap-a18b29c3' })).toThrow('Backup snapshot changed');
  });
});
