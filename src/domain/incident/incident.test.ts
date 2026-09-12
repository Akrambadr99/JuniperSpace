import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeIncident } from './analytics';
import { canEditIncident, incidentStates } from './policy';
import { countIncidentByState, searchIncident, selectIncident } from './selectors';
describe('incident domain module', () => { const records = fresh(product).entities; it('selects only incident records', () => expect(selectIncident(records).every(record => record.kind === 'incident')).toBe(true)); it('searches deterministic fields', () => { const first = selectIncident(records)[0]; expect(first ? searchIncident(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countIncidentByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectIncident(records).length)); it('exposes configured states', () => expect(incidentStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeIncident(records).total).toBe(selectIncident(records).length)); it('applies edit policy', () => expect(canEditIncident(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'incident')!.editors.includes(product.actors[0]!.role))); });
