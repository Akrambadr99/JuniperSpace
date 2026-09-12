/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Product, Kind, Field, Operation, Entity } from '../workspace/types';
import { entity, find, rows, total, text, number, requireThat } from '../workspace/values';
const txt = (key: string, label: string): Field => ({ key, label, type: 'text', required: true });
const num = (key: string, label: string, initial = 0, min = 0, max = Number.MAX_SAFE_INTEGER): Field => ({ key, label, type: 'number', required: true, integer: true, initial, min, max });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true, initial: '2026-09-12' });
const ref = (key: string, label: string, reference: string): Field => ({ key, label, type: 'reference', reference, required: true });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, type: 'select', options, required: true, initial: options[0] ?? '' });
const kind = (key: string, label: string, states: string[], editors: string[], fields: Field[]): Kind => ({ key, label, states, editors, fields, initial: states[0] ?? 'draft' });
const linked = (entities: Entity[], kind: string, key: string, id: string) => rows(entities, kind).filter(item => item.fields[key] === id);
void txt;
void num;
void date;
void ref;
void choice;
void kind;
void linked;
void entity;
void find;
void rows;
void total;
void text;
void number;
void requireThat;
const roles = ['Incident Commander', 'SOC Analyst', 'Security Engineer', 'Auditor'];
const kinds = [kind('alert', 'Security alerts', ['new', 'linked', 'dismissed'], [roles[1]!], [txt('asset', 'Affected asset'), txt('indicator', 'Indicator'), num('score', 'Risk score', 70, 0, 100)]), kind('incident', 'Incidents', ['triage', 'investigating', 'contained', 'recovered', 'closed'], [roles[0]!, roles[1]!], [choice('severity', 'Severity', ['low', 'medium', 'high', 'critical']), txt('owner', 'Incident owner')]), kind('link', 'Alert evidence links', ['active'], [], [ref('incident', 'Incident', 'incident'), ref('alert', 'Alert', 'alert'), txt('reason', 'Correlation reason')]), kind('evidence', 'Evidence items', ['collected', 'analyzed', 'sealed'], [roles[1]!, roles[2]!], [ref('incident', 'Incident', 'incident'), txt('sha256', 'SHA-256 digest'), txt('source', 'Evidence source')]), kind('playbook', 'Response steps', ['pending', 'complete', 'failed'], [roles[0]!], [ref('incident', 'Incident', 'incident'), txt('step', 'Required action'), choice('required', 'Requirement', ['yes', 'no'])])];
const operations: Operation[] = [{ key: 'link', label: 'Link alert to incident', kind: 'alert', from: ['new'], roles: [roles[1]!, roles[0]!], fields: [ref('incident', 'Target incident', 'incident'), txt('reason', 'Correlation reason')], run: ({ state, entity, input, add }) => { const incident = find(state.entities, text(input, 'incident')); entity.status = 'linked'; incident.status = 'investigating'; add('link', 'Correlation · ' + entity.title, { incident: incident.id, alert: entity.id, reason: text(input, 'reason') }, 'active'); return 'Alert linked while provenance and incident ownership were preserved.'; } }, { key: 'analyze', label: 'Record evidence analysis', kind: 'evidence', from: ['collected'], roles: [roles[2]!], run: ({ entity }) => { requireThat(/^sha256:[a-f0-9]{8,64}$/i.test(text(entity.fields, 'sha256')), 'Evidence digest format is invalid.'); entity.status = 'analyzed'; return 'Evidence analysis recorded with unchanged digest.'; } }, { key: 'seal', label: 'Seal evidence custody', kind: 'evidence', from: ['analyzed'], roles: [roles[0]!, roles[2]!], run: ({ entity }) => { entity.status = 'sealed'; return 'Evidence custody sealed against its digest.'; } }, { key: 'complete', label: 'Complete response step', kind: 'playbook', from: ['pending'], roles: [roles[0]!, roles[2]!], run: ({ entity }) => { entity.status = 'complete'; return 'Response action completed.'; } }, { key: 'contain', label: 'Declare containment', kind: 'incident', from: ['triage', 'investigating'], roles: [roles[0]!, roles[2]!], run: ({ state, entity }) => { const steps = linked(state.entities, 'playbook', 'incident', entity.id); requireThat(steps.filter(row => row.fields['required'] === 'yes').every(row => row.status === 'complete'), 'Required response actions remain incomplete.'); requireThat(linked(state.entities, 'evidence', 'incident', entity.id).every(row => row.status === 'sealed'), 'All incident evidence must be sealed.'); entity.status = 'contained'; return 'Containment declared after playbook and custody gates.'; } }, { key: 'recover', label: 'Record service recovery', kind: 'incident', from: ['contained'], roles: [roles[0]!], run: ({ entity }) => { entity.status = 'recovered'; return 'Recovery confirmed; incident ready for closure review.'; } }];
const seed = [entity('alert-1', 'alert', 'Suspicious PowerShell beacon', 'new', { asset: 'WS-204', indicator: '198.51.100.24', score: 92 }), entity('incident-1', 'incident', 'Endpoint compromise investigation', 'triage', { severity: 'critical', owner: 'Maya Hassan' }), entity('evidence-1', 'evidence', 'Memory image · WS-204', 'collected', { incident: 'incident-1', sha256: 'sha256:11223344aabbccdd', source: 'EDR acquisition' }), entity('playbook-1', 'playbook', 'Isolate affected endpoint', 'pending', { incident: 'incident-1', step: 'Remove endpoint from production VLAN', required: 'yes' })];
const validate: Product['validate'] = entities => {
    for (const link of rows(entities, 'link'))
        requireThat(find(entities, text(link.fields, 'alert')).status === 'linked', 'Active correlation points to an unlinked alert.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Critical incidents', value: String(rows(entities, 'incident').filter(row => row.fields['severity'] === 'critical' && row.status !== 'closed').length) }, { label: 'Unlinked alerts', value: String(rows(entities, 'alert').filter(row => row.status === 'new').length) }, { label: 'Sealed evidence', value: String(rows(entities, 'evidence').filter(row => row.status === 'sealed').length) }];
export const product: Product = { name: 'SentinelArc', description: 'Incident provenance, evidence custody and gated containment', accent: '#be123c', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
