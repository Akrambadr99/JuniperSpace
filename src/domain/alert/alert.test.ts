import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeAlert } from './analytics';
import { canEditAlert, alertStates } from './policy';
import { countAlertByState, searchAlert, selectAlert } from './selectors';
describe('alert domain module', () => { const records = fresh(product).entities; it('selects only alert records', () => expect(selectAlert(records).every(record => record.kind === 'alert')).toBe(true)); it('searches deterministic fields', () => { const first = selectAlert(records)[0]; expect(first ? searchAlert(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countAlertByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectAlert(records).length)); it('exposes configured states', () => expect(alertStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeAlert(records).total).toBe(selectAlert(records).length)); it('applies edit policy', () => expect(canEditAlert(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'alert')!.editors.includes(product.actors[0]!.role))); });
