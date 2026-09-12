import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzePlaybook } from './analytics';
import { canEditPlaybook, playbookStates } from './policy';
import { countPlaybookByState, searchPlaybook, selectPlaybook } from './selectors';
describe('playbook domain module', () => { const records = fresh(product).entities; it('selects only playbook records', () => expect(selectPlaybook(records).every(record => record.kind === 'playbook')).toBe(true)); it('searches deterministic fields', () => { const first = selectPlaybook(records)[0]; expect(first ? searchPlaybook(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countPlaybookByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectPlaybook(records).length)); it('exposes configured states', () => expect(playbookStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzePlaybook(records).total).toBe(selectPlaybook(records).length)); it('applies edit policy', () => expect(canEditPlaybook(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'playbook')!.editors.includes(product.actors[0]!.role))); });
