import type { Entity } from '../../workspace/types';
export type PlaybookRecord = Entity & {
    kind: 'playbook';
};
export function isPlaybook(record: Entity): record is PlaybookRecord { return record.kind === 'playbook'; }
