/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';
export function custodyTransfer(evidence: Entity | undefined, incident: Entity | undefined, recipient: string, acknowledged: boolean) {
    const blockers: string[] = [];
    if (!evidence || !incident)
        return { ready: false, blockers: ['Evidence and incident context are required.'] };
    if (evidence.status !== 'analyzed')
        blockers.push('Evidence must be analyzed before custody transfer.');
    if (!['investigating', 'contained'].includes(incident.status))
        blockers.push('The incident must be under active investigation or containment.');
    if (recipient.trim().length < 3 || recipient.trim() === evidence.fields['source'])
        blockers.push('Name a distinct receiving custodian.');
    if (!acknowledged)
        blockers.push('The receiver must acknowledge the immutable digest.');
    return { ready: blockers.length === 0, blockers };
}
export function DomainLifecyclePanel({ snapshot }: { snapshot: Snapshot }) {
    const evidenceItems = snapshot.entities.filter((item) => item.kind === 'evidence');
    const [evidenceId, setEvidenceId] = useState(evidenceItems[0]?.id ?? '');
    const [recipient, setRecipient] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const evidence = evidenceItems.find((item) => item.id === evidenceId);
    const incident = snapshot.entities.find((item) => item.id === evidence?.fields['incident']);
    const result = custodyTransfer(evidence, incident, recipient, acknowledged);
    return <section className="sub" aria-label="Evidence custody transfer"><h3>Evidence custody transfer <span>{result.ready ? 'ready' : 'blocked'}</span></h3><div className="filters"><select aria-label="Custody evidence" value={evidenceId} onChange={(event) => { setEvidenceId(event.target.value); setAcknowledged(false); }}>{evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input aria-label="Receiving custodian" value={recipient} onChange={(event) => setRecipient(event.target.value)}/><label><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/>Digest acknowledged</label></div><p><b>{String(evidence?.fields['sha256'] ?? 'No digest')}</b><small>{result.ready ? 'Custody transfer can be recorded without changing evidence bytes.' : result.blockers.join(' ')}</small></p></section>;
}
