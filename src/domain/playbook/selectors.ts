import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isPlaybook } from './model';
export function selectPlaybook(records: readonly Entity[]): Entity[] { return records.filter(isPlaybook).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findPlaybook(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isPlaybook(record) && record.id === id); }
export function searchPlaybook(records: readonly Entity[], query: string): Entity[] { return selectPlaybook(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countPlaybookByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectPlaybook(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
