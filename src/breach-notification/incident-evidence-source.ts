import type { Snapshot } from '../workspace/types';

/** A case association is operator-declared; incident and evidence state stay workspace-owned. */
export interface RegulatoryIncidentEvidence {
  incidentId: string;
  incidentRevision: number;
  evidenceId: string;
  evidenceRevision: number;
  digest: string;
  custodianId: string;
  acknowledgementId: string | null;
  associationReason: string;
}
export function readRegulatoryIncidentEvidence(source: Snapshot | undefined, incidentId: string, evidenceId: string, associationReason: string): RegulatoryIncidentEvidence {
  if (!source) throw new Error('Incident evidence source is unavailable. Refresh the owning incident workspace.');
  const incidents = source.entities.filter(item => item.id === incidentId && item.kind === 'incident');
  const evidenceItems = source.entities.filter(item => item.id === evidenceId && item.kind === 'evidence');
  const incident = incidents[0], evidence = evidenceItems[0];
  if (incidents.length !== 1 || evidenceItems.length !== 1 || !incident || evidence?.fields['incident'] !== incident.id) throw new Error('Select an existing incident and its own evidence; missing or unrelated references cannot authorize release.');
  const digest = evidence.fields['sha256'], custodian = evidence.fields['custodian'];
  if (evidence.status !== 'sealed' || typeof digest !== 'string' || !/^sha256:[a-f0-9]{8,64}$/i.test(digest) || typeof custodian !== 'string' || !custodian.trim()) throw new Error('Regulatory release requires sealed evidence with its authoritative digest and custodian.');
  if (source.entities.some(item => item.kind === 'transfer' && item.fields['evidence'] === evidenceId && item.status === 'requested')) throw new Error('Resolve the pending custody transfer before preparing or releasing incident evidence.');
  if (associationReason.trim().length < 20) throw new Error('Explain why this incident evidence belongs to the selected regulatory case.');
  const acknowledgement = source.entities.filter(item => item.kind === 'acknowledgement' && item.fields['evidence'] === evidenceId && item.fields['decision'] === 'accepted').at(-1);
  if (acknowledgement && (acknowledgement.fields['actor'] !== custodian || acknowledgement.fields['digest'] !== digest)) throw new Error('Current custody acknowledgement does not reconcile to the evidence owner and digest.');
  return { incidentId, incidentRevision: incident.revision, evidenceId, evidenceRevision: evidence.revision, digest, custodianId: custodian, acknowledgementId: acknowledgement?.id ?? null, associationReason: associationReason.trim() };
}
export function sameRegulatoryIncidentEvidence(left: RegulatoryIncidentEvidence | undefined, right: RegulatoryIncidentEvidence | undefined) {
  if (!left || !right) return left === right;
  return left.incidentId === right.incidentId && left.incidentRevision === right.incidentRevision && left.evidenceId === right.evidenceId && left.evidenceRevision === right.evidenceRevision && left.digest === right.digest && left.custodianId === right.custodianId && left.acknowledgementId === right.acknowledgementId && left.associationReason === right.associationReason;
}
export function requireCurrentRegulatoryEvidence(pin: RegulatoryIncidentEvidence | undefined, source: Snapshot | undefined) {
  if (!pin) return;
  const current = readRegulatoryIncidentEvidence(source, pin.incidentId, pin.evidenceId, pin.associationReason);
  if (!sameRegulatoryIncidentEvidence(pin, current)) throw new Error('Incident evidence or custody changed. Refresh source records and prepare a new case review; prior approval remains historical.');
}
