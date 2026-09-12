import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isIncident } from './model';
export function selectIncident(records: readonly Entity[]): Entity[] { return records.filter(isIncident).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findIncident(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isIncident(record) && record.id === id); }
export function searchIncident(records: readonly Entity[], query: string): Entity[] { return selectIncident(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countIncidentByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectIncident(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
