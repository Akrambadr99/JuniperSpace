import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isEvidence } from './model';
export function selectEvidence(records: readonly Entity[]): Entity[] { return records.filter(isEvidence).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findEvidence(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isEvidence(record) && record.id === id); }
export function searchEvidence(records: readonly Entity[], query: string): Entity[] { return selectEvidence(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countEvidenceByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectEvidence(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
