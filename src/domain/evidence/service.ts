import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findEvidence } from './selectors';
export function createEvidenceCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'evidence', title: input.title, input: input.fields }; }
export function applyEvidenceCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireEvidence(state: Snapshot, id: string) {
    const record = findEvidence(state.entities, id);
    if (!record)
        throw new Error('Evidence record was not found.');
    return record;
}
