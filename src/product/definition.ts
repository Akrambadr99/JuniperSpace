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
const operations: Operation[] = [{ key: 'link', label: 'Link alert to incident', kind: 'alert', from: ['new'], roles: [roles[1]!, roles[0]!], fields: [ref('incident', 'Target incident', 'incident'), txt('reason', 'Correlation reason')], run: ({ state, entity, input, add }) => { const incident = find(state.entities, text(input, 'incident')); requireThat(incident.status !== 'closed', 'Reopen the incident explicitly before linking new alerts.'); entity.status = 'linked'; incident.status = 'investigating'; add('link', 'Correlation · ' + entity.title, { incident: incident.id, alert: entity.id, reason: text(input, 'reason') }, 'active'); return 'Alert linked while provenance and incident ownership were preserved.'; } }, { key: 'analyze', label: 'Record evidence analysis', kind: 'evidence', from: ['collected'], roles: [roles[2]!], run: ({ entity }) => { requireThat(/^sha256:[a-f0-9]{8,64}$/i.test(text(entity.fields, 'sha256')), 'Evidence digest format is invalid.'); entity.status = 'analyzed'; return 'Evidence analysis recorded with unchanged digest.'; } }, { key: 'seal', label: 'Seal evidence custody', kind: 'evidence', from: ['analyzed'], roles: [roles[0]!, roles[2]!], run: ({ entity, actor }) => { entity.fields['custodian'] = actor.id; entity.status = 'sealed'; return 'Evidence custody sealed against its digest.'; } }, { key: 'complete', label: 'Complete response step', kind: 'playbook', from: ['pending'], roles: [roles[0]!, roles[2]!], run: ({ entity }) => { entity.status = 'complete'; return 'Response action completed.'; } }, { key: 'contain', label: 'Declare containment', kind: 'incident', from: ['triage', 'investigating'], roles: [roles[0]!, roles[2]!], run: ({ state, entity }) => { const steps = linked(state.entities, 'playbook', 'incident', entity.id); requireThat(steps.filter(row => row.fields['required'] === 'yes').every(row => row.status === 'complete'), 'Required response actions remain incomplete.'); requireThat(linked(state.entities, 'evidence', 'incident', entity.id).every(row => row.status === 'sealed'), 'All incident evidence must be sealed.'); entity.status = 'contained'; return 'Containment declared after playbook and custody gates.'; } }, { key: 'recover', label: 'Record service recovery', kind: 'incident', from: ['contained'], roles: [roles[0]!], run: ({ entity }) => { entity.status = 'recovered'; return 'Recovery confirmed; incident ready for closure review.'; } }];
const seed = [entity('alert-1', 'alert', 'Suspicious PowerShell beacon', 'new', { asset: 'WS-204', indicator: '198.51.100.24', score: 92 }), entity('incident-1', 'incident', 'Endpoint compromise investigation', 'triage', { severity: 'critical', owner: 'Maya Hassan' }), entity('evidence-1', 'evidence', 'Memory image · WS-204', 'collected', { incident: 'incident-1', sha256: 'sha256:11223344aabbccdd', source: 'EDR acquisition' }), entity('playbook-1', 'playbook', 'Isolate affected endpoint', 'pending', { incident: 'incident-1', step: 'Remove endpoint from production VLAN', required: 'yes' })];
kinds.find(item => item.key === 'evidence')!.fields.push({ ...txt('custodian', 'Current custodian'), required: false });
kinds.push(kind('transfer', 'Custody transfers', ['requested', 'accepted', 'rejected', 'cancelled'], [], [ref('evidence', 'Evidence item', 'evidence'), txt('sender', 'Sending custodian'), txt('recipient', 'Receiving custodian'), txt('digest', 'Pinned digest'), num('evidenceVersion', 'Evidence version', 1, 1), txt('reason', 'Transfer reason')]));
kinds.push(kind('acknowledgement', 'Custody acknowledgements', ['recorded'], [], [ref('transfer', 'Custody transfer', 'transfer'), ref('evidence', 'Evidence item', 'evidence'), txt('actor', 'Acknowledging actor'), txt('decision', 'Decision'), txt('digest', 'Acknowledged digest'), txt('recordedAt', 'Acknowledgement timestamp'), txt('note', 'Acknowledgement note')]));
kinds.push(kind('access', 'Evidence access grants', ['requested', 'approved', 'consumed', 'expired', 'rejected'], [], [ref('evidence', 'Evidence item', 'evidence'), txt('requester', 'Requesting analyst'), txt('custodian', 'Approving custodian'), txt('digest', 'Pinned digest'), num('evidenceVersion', 'Evidence version', 1, 1), date('expiresAt', 'Access expiry'), txt('purpose', 'Access purpose'), {...txt('usedAt', 'Accessed at'), required:false}]));
const custodian = (entities: Entity[], evidence: Entity) => evidence.fields['custodian'] ?? product.actors.find(actor => actor.name === find(entities, text(evidence.fields, 'incident'), 'incident').fields['owner'])?.id;
const acknowledgeTransfer = (decision: 'accepted' | 'rejected' | 'cancelled'): Operation['run'] => ({ state, entity, actor, input, now, add }) => {
    requireThat(actor.id === entity.fields[decision === 'cancelled' ? 'sender' : 'recipient'], decision === 'cancelled' ? 'Only the sending custodian can cancel this transfer.' : 'Only the named recipient can acknowledge this transfer.');
    requireThat(text(input, 'note').trim().length >= 12, 'Provide a specific custody acknowledgement note.');
    const evidence = find(state.entities, text(entity.fields, 'evidence'), 'evidence');
    if (decision === 'accepted') {
        requireThat(evidence.status === 'sealed' && evidence.revision === entity.fields['evidenceVersion'] && evidence.fields['sha256'] === entity.fields['digest'] && custodian(state.entities, evidence) === entity.fields['sender'], 'Evidence or ownership changed. Reject this request and obtain a fresh transfer.');
        evidence.fields['custodian'] = actor.id;
    }
    entity.status = decision;
    add('acknowledgement', 'Custody ' + decision + ' · ' + evidence.title, { transfer: entity.id, evidence: evidence.id, actor: actor.id, decision, digest: text(entity.fields, 'digest'), recordedAt: now, note: text(input, 'note').trim() });
    return 'Custody transfer ' + decision + '; immutable acknowledgement appended and evidence digest preserved.';
};
operations.push(
    { key: 'request-transfer', label: 'Request custody transfer', kind: 'evidence', from: ['sealed'], roles: roles.slice(0, 3), fields: [choice('recipient', 'Receiving custodian', ['Maya Hassan', 'Omar Saleh', 'Lina Farouk']), txt('reason', 'Transfer reason')], run: ({ state, entity, actor, input, add }) => {
        requireThat(custodian(state.entities, entity) === actor.id, 'Only the current custodian can request a transfer.');
        const recipient = product.actors.find(item => item.name === input['recipient'] && item.role !== 'Auditor');
        requireThat(recipient && recipient.id !== actor.id, 'Choose a different authorized custodian.');
        requireThat(!rows(state.entities, 'transfer').some(item => item.fields['evidence'] === entity.id && item.status === 'requested'), 'A pending custody transfer already exists.');
        requireThat(text(input, 'reason').trim().length >= 12, 'Describe the reason for transferring custody.');
        add('transfer', 'Transfer · ' + entity.title, { evidence: entity.id, sender: actor.id, recipient: recipient.id, digest: text(entity.fields, 'sha256'), evidenceVersion: entity.revision, reason: text(input, 'reason').trim() });
        return 'Custody transfer requested; ownership stays with the sender until acceptance.';
    } },
    { key: 'accept-transfer', label: 'Accept custody transfer', kind: 'transfer', from: ['requested'], roles: roles.slice(0, 3), fields: [txt('note', 'Acknowledgement note')], run: acknowledgeTransfer('accepted') },
    { key: 'reject-transfer', label: 'Reject custody transfer', kind: 'transfer', from: ['requested'], roles: roles.slice(0, 3), fields: [txt('note', 'Acknowledgement note')], run: acknowledgeTransfer('rejected') },
    { key: 'cancel-transfer', label: 'Cancel custody transfer', kind: 'transfer', from: ['requested'], roles: roles.slice(0, 3), fields: [txt('note', 'Acknowledgement note')], run: acknowledgeTransfer('cancelled') },
);
operations.push(
    {key:'request-access',label:'Request evidence access',kind:'evidence',from:['sealed'],roles:[roles[1]!],fields:[date('until','Access expiry'),txt('purpose','Access purpose')],run:({state,entity,actor,input,now,add}) => {
        const owner=custodian(state.entities,entity),until=Date.parse(text(input,'until')),started=Date.parse(now);
        requireThat(owner !== actor.id,'The current custodian does not require a separate access grant.');
        requireThat(until > started && until-started <= 2*86400000,'Access expiry must be within the next two days.');
        requireThat(text(input,'purpose').trim().length >= 12,'Provide a specific evidence access purpose.');
        requireThat(!linked(state.entities,'access','evidence',entity.id).some(item => item.fields['requester'] === actor.id && ['requested','approved'].includes(item.status)),'This analyst already has a pending access grant.');
        add('access','Access · '+entity.title,{evidence:entity.id,requester:actor.id,custodian:String(owner),digest:text(entity.fields,'sha256'),evidenceVersion:entity.revision,expiresAt:text(input,'until'),purpose:text(input,'purpose').trim()});
        return 'Evidence access requested against current custody and digest.';
    }},
    {key:'approve-access',label:'Approve evidence access',kind:'access',from:['requested'],roles:roles.slice(0,3),run:({state,entity,actor,now}) => {
        const evidence=find(state.entities,text(entity.fields,'evidence'),'evidence');
        requireThat(actor.id === entity.fields['custodian'] && actor.id !== entity.fields['requester'],'Only the independent current custodian can approve access.');
        requireThat(custodian(state.entities,evidence) === actor.id && evidence.revision === entity.fields['evidenceVersion'] && evidence.fields['sha256'] === entity.fields['digest'],'Evidence or custody changed. Submit a fresh access request.');
        requireThat(Date.parse(now) < Date.parse(text(entity.fields,'expiresAt')),'Access request has expired.');
        entity.status='approved';return 'Custodian approved time-bounded evidence access.';
    }},
    {key:'use-access',label:'Open evidence with grant',kind:'access',from:['approved'],roles:[roles[1]!],run:({state,entity,actor,now}) => {
        requireThat(actor.id === entity.fields['requester'],'Only the requesting analyst can use this access grant.');
        const evidence=find(state.entities,text(entity.fields,'evidence'),'evidence');
        requireThat(Date.parse(now) < Date.parse(text(entity.fields,'expiresAt')),'Evidence access grant has expired.');
        requireThat(evidence.revision === entity.fields['evidenceVersion'] && evidence.fields['sha256'] === entity.fields['digest'] && custodian(state.entities,evidence) === entity.fields['custodian'],'Evidence or custody changed. Request access again.');
        entity.status='consumed';entity.fields['usedAt']=now;return 'Evidence access recorded; custody and digest remained unchanged.';
    }},
    {key:'expire-access',label:'Expire unused evidence access',kind:'access',from:['requested','approved'],roles:roles.slice(0,3),run:({entity,actor,now}) => {
        requireThat(actor.id === entity.fields['custodian'],'Only the approving custodian can expire this grant.');
        requireThat(Date.parse(now) >= Date.parse(text(entity.fields,'expiresAt')),'Evidence access grant has not expired.');
        entity.status='expired';return 'Unused evidence access expired without changing custody.';
    }},
);

kinds.push(kind('closure', 'Incident review history', ['recorded'], [], [ref('incident','Incident','incident'),choice('decision','Review decision',['close','reopen']),txt('actor','Reviewing owner'),txt('at','Review time'),txt('note','Review rationale'),{...txt('evidence','Custody evidence snapshot'),max:1000000}]));
operations.push(
    {key:'close-incident',label:'Close recovered incident',kind:'incident',from:['recovered'],roles:[roles[0]!],fields:[txt('note','Closure rationale')],run:({state,entity,actor,input,now,add}) => {
        requireThat(entity.fields['owner'] === actor.name,'Only the accountable incident owner can close this incident.');
        requireThat(text(input,'note').trim().length >= 20,'Provide a closure rationale of at least 20 characters.');
        const evidence=linked(state.entities,'evidence','incident',entity.id);
        requireThat(evidence.length > 0 && evidence.every(item => item.status === 'sealed'),'Closure requires sealed evidence for every incident item.');
        requireThat(linked(state.entities,'playbook','incident',entity.id).filter(item => item.fields['required'] === 'yes').every(item => item.status === 'complete'),'Complete required response steps before closure.');
        const ids=new Set(evidence.map(item => item.id));const transfers=rows(state.entities,'transfer').filter(item => ids.has(text(item.fields,'evidence')));
        requireThat(!transfers.some(item => item.status === 'requested'),'Resolve pending custody transfers before closure.');
        add('closure','Closure - '+entity.title,{incident:entity.id,decision:'close',actor:actor.id,at:now,note:text(input,'note').trim(),evidence:JSON.stringify({evidence,transfers,acknowledgements:rows(state.entities,'acknowledgement').filter(item => ids.has(text(item.fields,'evidence')))})});
        entity.status='closed';return 'Incident closed with immutable custody review evidence.';
    }},
    {key:'reopen-incident',label:'Reopen incident investigation',kind:'incident',from:['closed'],roles:[roles[0]!],fields:[txt('note','Reopening rationale')],run:({state,entity,actor,input,now,add}) => {
        requireThat(entity.fields['owner'] === actor.name,'Only the accountable incident owner can reopen this incident.');
        requireThat(text(input,'note').trim().length >= 20,'Provide a reopening rationale of at least 20 characters.');
        add('closure','Reopening - '+entity.title,{incident:entity.id,decision:'reopen',actor:actor.id,at:now,note:text(input,'note').trim(),evidence:JSON.stringify(linked(state.entities,'closure','incident',entity.id).map(item => item.id))});
        entity.status='investigating';return 'Investigation reopened; prior closure and custody history retained.';
    }},
);
const validate: Product['validate'] = entities => {
    for (const link of rows(entities, 'link'))
        requireThat(find(entities, text(link.fields, 'alert')).status === 'linked', 'Active correlation points to an unlinked alert.');
    for (const grant of rows(entities,'access').filter(item => ['approved','consumed'].includes(item.status))) requireThat(Boolean(grant.fields['custodian']) && Boolean(grant.fields['digest']),'Approved evidence access requires pinned custody evidence.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Critical incidents', value: String(rows(entities, 'incident').filter(row => row.fields['severity'] === 'critical' && row.status !== 'closed').length) }, { label: 'Unlinked alerts', value: String(rows(entities, 'alert').filter(row => row.status === 'new').length) }, { label: 'Sealed evidence', value: String(rows(entities, 'evidence').filter(row => row.status === 'sealed').length) }];
export const product: Product = { name: 'SentinelArc', description: 'Incident provenance, evidence custody and gated containment', accent: '#be123c', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
