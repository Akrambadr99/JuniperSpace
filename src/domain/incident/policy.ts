import type { Product } from '../../workspace/types';
export function incidentStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'incident')?.states ?? []; }
export function canEditIncident(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'incident')?.editors.includes(role) ?? false; }
export function incidentOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'incident' && operation.roles.includes(role) && operation.from.includes(state)); }
