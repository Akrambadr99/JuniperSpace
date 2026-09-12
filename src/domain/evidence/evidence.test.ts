import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeEvidence } from './analytics';
import { canEditEvidence, evidenceStates } from './policy';
import { countEvidenceByState, searchEvidence, selectEvidence } from './selectors';
describe('evidence domain module', () => { const records = fresh(product).entities; it('selects only evidence records', () => expect(selectEvidence(records).every(record => record.kind === 'evidence')).toBe(true)); it('searches deterministic fields', () => { const first = selectEvidence(records)[0]; expect(first ? searchEvidence(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countEvidenceByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectEvidence(records).length)); it('exposes configured states', () => expect(evidenceStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeEvidence(records).total).toBe(selectEvidence(records).length)); it('applies edit policy', () => expect(canEditEvidence(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'evidence')!.editors.includes(product.actors[0]!.role))); });
