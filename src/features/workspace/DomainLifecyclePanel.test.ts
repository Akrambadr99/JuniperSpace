import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { custodyTransfer } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('custodyTransfer', () => {
    it('requires analyzed evidence, active incident, recipient, and acknowledgement', () => expect(custodyTransfer(entity('e', 'evidence', 'collected'), entity('i', 'incident', 'triage'), '', false).blockers).toHaveLength(4));
    it('accepts an acknowledged transfer during investigation', () => expect(custodyTransfer(entity('e', 'evidence', 'analyzed', { source: 'EDR' }), entity('i', 'incident', 'investigating'), 'Forensics', true).ready).toBe(true));
});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
const run = (state: Snapshot, id: string, target: string, operation: string, actorId = 'actor-2', input: Record<string, Value> = {}) => execute(state, { id, entityId: target, operation, actorId, input, expectedRevision: state.revision, type: 'operate' }, product, '2026-09-12T10:00:00Z');
const sealed = () => run(run(fresh(product), 'analyze', 'evidence-1', 'analyze'), 'seal', 'evidence-1', 'seal');
const requested = () => run(sealed(), 'request', 'evidence-1', 'request-transfer', 'actor-2', { recipient: 'Maya Hassan', reason: 'Transfer sealed evidence for incident review.' });
describe('durable custody transfers', () => {
    it('changes ownership only on recipient acceptance and preserves immutable acknowledgements', () => {
        let state = requested();
        expect(state.entities.find(item => item.id === 'evidence-1')?.fields['custodian']).toBe('actor-2');
        state = run(state, 'accept', 'request-1', 'accept-transfer', 'actor-0', { note: 'Received sealed evidence with matching digest.' });
        const acknowledgement = structuredClone(state.entities.find(item => item.id === 'accept-1'));
        state = run(state, 'next', 'evidence-1', 'request-transfer', 'actor-0', { recipient: 'Omar Saleh', reason: 'Transfer evidence for follow-up investigation.' });
        state = run(state, 'reject', 'next-1', 'reject-transfer', 'actor-1', { note: 'Unable to receive evidence during this shift.' });
        expect(state.entities.find(item => item.id === 'accept-1')).toEqual(acknowledgement);
        expect(state.entities.find(item => item.id === 'evidence-1')).toMatchObject({ status: 'sealed', fields: { custodian: 'actor-0', sha256: 'sha256:11223344aabbccdd' } });
        expect(state.entities.filter(item => item.kind === 'acknowledgement')).toHaveLength(2);
    });
    it('rejects non-owner requests, wrong recipients and concurrent pending transfers', () => {
        expect(() => run(sealed(), 'wrong-owner', 'evidence-1', 'request-transfer', 'actor-1', { recipient: 'Maya Hassan', reason: 'Transfer sealed evidence for incident review.' })).toThrow('current custodian');
        const state = requested();
        expect(() => run(state, 'wrong-recipient', 'request-1', 'accept-transfer', 'actor-2', { note: 'Received sealed evidence with matching digest.' })).toThrow('named recipient');
        expect(() => run(state, 'duplicate', 'evidence-1', 'request-transfer', 'actor-2', { recipient: 'Omar Saleh', reason: 'Transfer sealed evidence for incident review.' })).toThrow('pending');
    });
    it('retains state on stale acceptance and allows rejection followed by a fresh request', () => {
        let state = requested();
        const evidence = state.entities.find(item => item.id === 'evidence-1');
        if (!evidence) throw new Error('Missing evidence');
        evidence.revision += 1;
        const before = structuredClone(state);
        expect(() => run(state, 'stale', 'request-1', 'accept-transfer', 'actor-0', { note: 'Received sealed evidence with matching digest.' })).toThrow('changed');
        expect(state).toEqual(before);
        state = run(state, 'reject', 'request-1', 'reject-transfer', 'actor-0', { note: 'Please submit a transfer for current evidence.' });
        state = run(state, 'retry', 'evidence-1', 'request-transfer', 'actor-2', { recipient: 'Maya Hassan', reason: 'Transfer refreshed evidence for incident review.' });
        expect(run(state, 'accept', 'retry-1', 'accept-transfer', 'actor-0', { note: 'Received sealed evidence with matching digest.' }).entities.find(item => item.id === 'evidence-1')?.fields['custodian']).toBe('actor-0');
    });
});
