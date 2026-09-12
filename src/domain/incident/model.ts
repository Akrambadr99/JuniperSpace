import type { Entity } from '../../workspace/types';
export type IncidentRecord = Entity & {
    kind: 'incident';
};
export function isIncident(record: Entity): record is IncidentRecord { return record.kind === 'incident'; }
