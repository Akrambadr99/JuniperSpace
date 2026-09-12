import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isAlert } from './model';
export function selectAlert(records: readonly Entity[]): Entity[] { return records.filter(isAlert).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findAlert(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isAlert(record) && record.id === id); }
export function searchAlert(records: readonly Entity[], query: string): Entity[] { return selectAlert(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countAlertByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectAlert(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
