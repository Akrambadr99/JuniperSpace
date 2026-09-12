import { describe, expect, it } from 'vitest';
import { advanceContainment, evidenceChain, mergeIncidents, severityFor, splitAlert } from './provenance';
import { alerts, evidence, incidents, steps } from './fixtures';
describe('incident provenance graph', () => {
    it('recalculates severity and deduplicates links when incidents merge', () => {
        const merged = mergeIncidents(incidents[0]!, incidents[1]!, alerts, [6, 2], 'Incident Commander');
        expect(merged.severity).toBe('critical');
        expect(merged.alertIds).toHaveLength(3);
        expect(severityFor([{ ...alerts[0]!, score: 10 }])).toBe('low');
        expect(severityFor([{ ...alerts[0]!, score: 50 }])).toBe('medium');
        expect(severityFor([{ ...alerts[0]!, score: 75 }])).toBe('high');
    });
    it('guards merge authority and optimistic versions', () => {
        expect(() => mergeIncidents(incidents[0]!, incidents[1]!, alerts, [5, 2], 'SOC Analyst')).toThrow(/changed/);
        expect(() => mergeIncidents(incidents[0]!, incidents[1]!, alerts, [6, 2], 'Auditor')).toThrow(/permission/);
    });
    it('splits an alert while preserving both provenance branches', () => {
        const result = splitAlert(incidents[0]!, 'AL-904', 'INC-92');
        expect(result.remaining.provenance.at(-1)).toMatch(/Separated/);
        expect(result.separated.provenance[0]).toMatch(/INC-77/);
        expect(() => splitAlert(incidents[0]!, 'missing', 'INC-92')).toThrow(/not linked/);
        expect(() => splitAlert(incidents[1]!, 'AL-910', 'INC-92')).toThrow(/single-alert/);
    });
    it('requires response steps and containment authority', () => {
        expect(() => advanceContainment(incidents[0]!, steps, 'Security Engineer')).toThrow(/remain/);
        const complete = steps.map((step) => ({ ...step, state: 'complete' as const }));
        expect(() => advanceContainment(incidents[0]!, complete, 'Auditor')).toThrow(/authority/);
        expect(advanceContainment(incidents[0]!, complete, 'Incident Commander').state).toBe('contained');
    });
    it('traces evidence parentage and handles absent roots', () => {
        expect(evidenceChain(evidence, 'EV-2').map((item) => item.id)).toEqual(['EV-1', 'EV-2']);
        expect(evidenceChain(evidence, 'missing')).toEqual([]);
        expect(() => evidenceChain([...evidence, { ...evidence[0]!, id: 'LOOP', parentId: 'LOOP' }], 'LOOP')).toThrow(/cycle/);
    });
});
