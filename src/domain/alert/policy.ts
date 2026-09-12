import type { Product } from '../../workspace/types';
export function alertStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'alert')?.states ?? []; }
export function canEditAlert(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'alert')?.editors.includes(role) ?? false; }
export function alertOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'alert' && operation.roles.includes(role) && operation.from.includes(state)); }
