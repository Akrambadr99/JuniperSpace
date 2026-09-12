import type { Product } from '../../workspace/types';
export function evidenceStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'evidence')?.states ?? []; }
export function canEditEvidence(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'evidence')?.editors.includes(role) ?? false; }
export function evidenceOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'evidence' && operation.roles.includes(role) && operation.from.includes(state)); }
