import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isLink } from './model';
export function selectLink(records: readonly Entity[]): Entity[] { return records.filter(isLink).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findLink(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isLink(record) && record.id === id); }
export function searchLink(records: readonly Entity[], query: string): Entity[] { return selectLink(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countLinkByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectLink(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
