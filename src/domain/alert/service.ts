import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findAlert } from './selectors';
export function createAlertCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'alert', title: input.title, input: input.fields }; }
export function applyAlertCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireAlert(state: Snapshot, id: string) {
    const record = findAlert(state.entities, id);
    if (!record)
        throw new Error('Alert record was not found.');
    return record;
}
