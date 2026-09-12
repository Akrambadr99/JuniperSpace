import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';
const note = 'Digest independently observed from the acquired evidence copy.';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'c-' + String(state.revision), expectedRevision: state.revision, actorId, type: 'operate', operation, entityId, input }, product, '2026-09-13T12:00:00Z');
}
function sealed() { return act(act(fresh(product), 'analyze', 'evidence-1', 'actor-2'), 'seal', 'evidence-1', 'actor-2'); }
function mismatch(state = sealed()) { return act(state, 'integrity-observe', 'evidence-1', 'actor-2', { observed: 'sha256:deadbeef', note }); }
describe('evidence integrity quarantine', () => {
    it('quarantines mismatched evidence without rewriting its pinned digest', () => {
        const state = mismatch();
        expect(state.entities.find(item => item.id === 'evidence-1')).toMatchObject({ status: 'quarantined', fields: { sha256: 'sha256:11223344aabbccdd' } });
        expect(state.entities.find(item => item.id === 'incident-1')?.status).toBe('investigating');
        expect(state.entities.filter(item => item.kind === 'integrity-check')).toHaveLength(1);
    });
    it('invalidates approved access and does not reactivate it after restoration', () => {
        let state = act(sealed(), 'request-access', 'evidence-1', 'actor-1', { until: '2026-09-14', purpose: 'Review the captured acquisition evidence.' });
        state = act(state, 'approve-access', 'c-2-1', 'actor-2');state = mismatch(state);
        expect(state.entities.find(item => item.id === 'c-2-1')?.status).toBe('expired');
        state = act(state, 'integrity-observe', 'evidence-1', 'actor-2', { observed: 'sha256:11223344aabbccdd', note });
        state = act(state, 'integrity-restore', 'evidence-1', 'actor-0', { note });
        expect(state.entities.find(item => item.id === 'evidence-1')?.status).toBe('sealed');
        expect(state.entities.find(item => item.id === 'c-2-1')?.status).toBe('expired');
        expect(state.entities.filter(item => item.kind === 'integrity-check').map(item => item.status)).toEqual(['mismatch', 'matched']);
    });
    it('requires fresh matching evidence and the commander role for restoration', () => {
        const state = mismatch();
        expect(() => act(state, 'integrity-restore', 'evidence-1', 'actor-0', { note })).toThrow(/matching integrity/);
        expect(() => act(state, 'integrity-restore', 'evidence-1', 'actor-2', { note })).toThrow(/role/);
    });
    it('blocks custody acceptance while evidence is quarantined', () => {
        let state = act(sealed(), 'request-transfer', 'evidence-1', 'actor-2', { recipient: 'Maya Hassan', reason: 'Transfer custody for independent review.' });
        state = mismatch(state);
        expect(() => act(state, 'accept-transfer', 'c-2-1', 'actor-0', { note })).toThrow(/Evidence or ownership changed/);
    });
});
