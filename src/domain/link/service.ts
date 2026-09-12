import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findLink } from './selectors';
export function createLinkCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'link', title: input.title, input: input.fields }; }
export function applyLinkCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireLink(state: Snapshot, id: string) {
    const record = findLink(state.entities, id);
    if (!record)
        throw new Error('Link record was not found.');
    return record;
}
