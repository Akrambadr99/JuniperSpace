import type { Entity } from '../../workspace/types';
export type LinkRecord = Entity & {
    kind: 'link';
};
export function isLink(record: Entity): record is LinkRecord { return record.kind === 'link'; }
