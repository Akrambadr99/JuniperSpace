import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { custodyTransfer } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('custodyTransfer', () => {
    it('requires analyzed evidence, active incident, recipient, and acknowledgement', () => expect(custodyTransfer(entity('e', 'evidence', 'collected'), entity('i', 'incident', 'triage'), '', false).blockers).toHaveLength(4));
    it('accepts an acknowledged transfer during investigation', () => expect(custodyTransfer(entity('e', 'evidence', 'analyzed', { source: 'EDR' }), entity('i', 'incident', 'investigating'), 'Forensics', true).ready).toBe(true));
});
