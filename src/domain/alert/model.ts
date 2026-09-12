import type { Entity } from '../../workspace/types';
export type AlertRecord = Entity & {
    kind: 'alert';
};
export function isAlert(record: Entity): record is AlertRecord { return record.kind === 'alert'; }
