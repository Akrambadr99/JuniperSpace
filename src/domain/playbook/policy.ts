import type { Product } from '../../workspace/types';
export function playbookStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'playbook')?.states ?? []; }
export function canEditPlaybook(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'playbook')?.editors.includes(role) ?? false; }
export function playbookOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'playbook' && operation.roles.includes(role) && operation.from.includes(state)); }
