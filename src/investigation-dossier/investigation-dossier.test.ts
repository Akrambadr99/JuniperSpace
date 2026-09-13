import { describe, expect, it } from 'vitest';
import { approveContainment, closeInvestigation, executeContainment, initialInvestigationState, openInvestigation, refreshRemediationTelemetry, sealInvestigationEvidence, verifyRemediation } from './investigation-dossier';
const meta = (id: string, revision: number, actor: string, role: 'SOC Analyst' | 'Evidence Custodian' | 'Incident Commander' | 'Security Engineer' | 'Auditor') => ({ id, expectedRevision: revision, actor: { id: actor, role } });

describe('investigation dossier', () => {
  it('preserves evidence while containing and closing a critical alert', () => {
    let state = openInvestigation(initialInvestigationState, meta('open', 0, 'analyst', 'SOC Analyst'));
    state = sealInvestigationEvidence(state, { ...meta('seal', 1, 'custodian', 'Evidence Custodian'), checksum: 'sha256:940abc' });
    state = approveContainment(state, { ...meta('approve', 2, 'commander', 'Incident Commander'), actions: ['revoke-sessions', 'rotate-credential'], rationale: 'Critical identity activity requires immediate session and credential containment.' });
    state = executeContainment(state, meta('execute', 3, 'engineer', 'Security Engineer'));
    state = refreshRemediationTelemetry(state, { ...meta('refresh', 4, 'engineer', 'Security Engineer'), activeSessions: 0, maliciousHits: 0 });
    state = verifyRemediation(state, { ...meta('verify', 5, 'auditor', 'Auditor'), rationale: 'Fresh telemetry confirms revoked sessions and zero malicious activity.' });
    state = closeInvestigation(state, meta('close', 6, 'commander', 'Incident Commander'));
    expect(state.alert.status).toBe('closed');
    expect(state.identity.status).toBe('restored');
    expect(state.evidence).toMatchObject({ status: 'sealed', checksum: 'sha256:940abc' });
    expect(state.events).toHaveLength(7);
  });

  it('blocks containment after evidence integrity changes', () => {
    let state = openInvestigation(initialInvestigationState, meta('open', 0, 'analyst', 'SOC Analyst'));
    state = sealInvestigationEvidence(state, { ...meta('seal', 1, 'custodian', 'Evidence Custodian'), checksum: 'sha256:940abc' });
    state.evidence.checksum = 'sha256:tampered';
    expect(() => approveContainment(state, { ...meta('approve', 2, 'commander', 'Incident Commander'), actions: ['revoke-sessions', 'rotate-credential'], rationale: 'Critical identity activity requires immediate session and credential containment.' })).toThrow('checksum changed');
    expect(state.identity.status).toBe('active');
  });
});
