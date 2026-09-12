import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findIncident } from './selectors';
export function createIncidentCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'incident', title: input.title, input: input.fields }; }
export function applyIncidentCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireIncident(state: Snapshot, id: string) {
    const record = findIncident(state.entities, id);
    if (!record)
        throw new Error('Incident record was not found.');
    return record;
}
