import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeLink } from './analytics';
import { canEditLink, linkStates } from './policy';
import { countLinkByState, searchLink, selectLink } from './selectors';
describe('link domain module', () => { const records = fresh(product).entities; it('selects only link records', () => expect(selectLink(records).every(record => record.kind === 'link')).toBe(true)); it('searches deterministic fields', () => { const first = selectLink(records)[0]; expect(first ? searchLink(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countLinkByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectLink(records).length)); it('exposes configured states', () => expect(linkStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeLink(records).total).toBe(selectLink(records).length)); it('applies edit policy', () => expect(canEditLink(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'link')!.editors.includes(product.actors[0]!.role))); });
