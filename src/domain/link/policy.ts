import type { Product } from '../../workspace/types';
export function linkStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'link')?.states ?? []; }
export function canEditLink(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'link')?.editors.includes(role) ?? false; }
export function linkOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'link' && operation.roles.includes(role) && operation.from.includes(state)); }
