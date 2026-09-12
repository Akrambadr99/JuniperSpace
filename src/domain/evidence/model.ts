import type { Entity } from '../../workspace/types';
export type EvidenceRecord = Entity & {
    kind: 'evidence';
};
export function isEvidence(record: Entity): record is EvidenceRecord { return record.kind === 'evidence'; }
