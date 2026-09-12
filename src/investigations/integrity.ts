import type { Context, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, rows, text } from '../workspace/values';
const note: Field = { key: 'note', label: 'Integrity review note', type: 'text', required: true };
export const integrityCheckKind: Kind = {
    key: 'integrity-check', label: 'Integrity observations', initial: 'matched', editors: [], states: ['matched', 'mismatch'],
    fields: [
        { key: 'evidence', label: 'Evidence item', type: 'reference', reference: 'evidence', required: true },
        { key: 'observed', label: 'Observed digest', type: 'text', required: true },
        { key: 'expected', label: 'Pinned digest', type: 'text', required: true },
        { key: 'actor', label: 'Observing actor', type: 'text', required: true },
        { key: 'at', label: 'Observed at', type: 'text', required: true }, note,
    ],
};
function rationale(context: Context) {
    const value = text(context.input, 'note').trim();
    requireThat(value.length >= 20, 'Provide at least 20 characters explaining the integrity review.');
    return value;
}
function incidentFor(context: Context) {
    const incident = find(context.state.entities, text(context.entity.fields, 'incident'), 'incident');
    requireThat(incident.status !== 'closed', 'Reopen the incident before reviewing evidence integrity.');
    return incident;
}
export const integrityOperations: Operation[] = [
    {
        key: 'integrity-observe', label: 'Record integrity observation', kind: 'evidence', from: ['sealed', 'quarantined'], roles: ['Security Engineer'],
        fields: [{ key: 'observed', label: 'Observed digest', type: 'text', required: true }, note],
        run: context => {
            const incident = incidentFor(context);
            const observed = text(context.input, 'observed').trim().toLowerCase();
            requireThat(/^sha256:[a-f0-9]{8,64}$/.test(observed), 'Provide a SHA-256 digest observation in the supported format.');
            const expected = text(context.entity.fields, 'sha256').toLowerCase();
            const matched = observed === expected;
            context.add('integrity-check', 'Integrity observation - ' + context.entity.title, {
                evidence: context.entity.id, observed, expected, actor: context.actor.id, at: context.now, note: rationale(context),
            }, matched ? 'matched' : 'mismatch');
            if (!matched) {
                context.entity.status = 'quarantined';
                incident.status = 'investigating';
                for (const grant of rows(context.state.entities, 'access').filter(item => item.fields['evidence'] === context.entity.id && ['requested', 'approved'].includes(item.status))) grant.status = 'expired';
                return 'Digest mismatch recorded; evidence quarantined and unused access grants invalidated. Original digest preserved.';
            }
            return 'Matching digest observation recorded; quarantined evidence still requires commander restoration.';
        },
    },
    {
        key: 'integrity-restore', label: 'Restore verified evidence', kind: 'evidence', from: ['quarantined'], roles: ['Incident Commander'], fields: [note],
        run: context => {
            incidentFor(context);
            const latest = rows(context.state.entities, 'integrity-check').filter(item => item.fields['evidence'] === context.entity.id).at(-1);
            requireThat(latest?.status === 'matched' && latest.fields['expected'] === text(context.entity.fields, 'sha256').toLowerCase(), 'Record a current matching integrity observation before restoration.');
            requireThat(latest.fields['actor'] !== context.actor.id, 'Restoration requires an independent commander.');
            const reason = rationale(context);context.entity.status = 'sealed';
            return 'Verified evidence restored; prior mismatches and invalidated grants remain in history: ' + reason;
        },
    },
];
