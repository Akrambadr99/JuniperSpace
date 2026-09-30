import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { product } from '../product/definition';
import { Repository } from '../workspace/repository';
import type { Value } from '../workspace/types';
import { readRegulatoryIncidentEvidence } from './incident-evidence-source';
import { BrowserRegulatorResponsePersistence, RegulatorResponseRepository } from './regulator-response-domain';
import { RegulatorResponseControl } from './RegulatorResponseControl';

const time = '2026-09-30T10:00:00Z';
const reason = 'The acquired endpoint image supports this regulatory investigation.';
function fixture() {
  const source = new Repository(product, localStorage);
  const operate = (id: string, entityId: string, operation: string, actorId = 'actor-2', input: Record<string, Value> = {}) => source.commit({ id, expectedRevision: source.read().revision, entityId, operation, actorId, input, type: 'operate' }, time);
  operate('analyze', 'evidence-1', 'analyze'); operate('seal', 'evidence-1', 'seal');
  const response = new RegulatorResponseRepository(localStorage, () => source.read());
  const prepare = (id = 'prepare') => response.dispatch({ id, expectedRevision: response.read().revision, role: 'Compliance Analyst', responseId: 'REG-FCA-204', evidenceIds: ['EVD-DEVICE-7', 'external-acquisition-report'], amendmentEvidence: null, reason, preparedBy: 'Compliance analyst', preparedOn: '2026-10-20T17:00:00Z', casePreparation: true, incidentEvidence: readRegulatoryIncidentEvidence(source.read(), 'incident-1', 'evidence-1', reason) });
  const schedule = () => response.dispatch({ id: 'schedule', expectedRevision: response.read().revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', reviewer: 'Privacy counsel', reviewOn: '2026-10-20T18:00:00Z', asOf: '2026-10-20', reason });
  const review = (id = 'review', decision: 'approved' | 'returned' = 'approved') => response.dispatch({ id, expectedRevision: response.read().revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', preparationId: response.read().casePreparations.at(-1)?.id ?? '', decision, rationale: reason, reviewer: 'Privacy counsel', reviewedOn: '2026-10-20T18:00:00Z', caseLegalReview: true });
  const dispatch = () => response.dispatch({ id: 'dispatch', expectedRevision: response.read().revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', releaseReference: 'RELEASE-SOURCE', releaseRevision: response.read().revision, status: 'succeeded', failureClassification: null, retryEligible: false, actor: 'Compliance lead', attemptedOn: '2026-10-20T19:00:00Z', retryOf: null, dispatchEvidence: 'RECEIPT-001' });
  return { source, response, operate, prepare, schedule, review, dispatch };
}
beforeEach(() => localStorage.clear());
describe('authoritative regulatory incident evidence', () => {
  it('pins actual ownership, rechecks custody at dispatch, and preserves old approved evidence through correction', () => {
    const f = fixture(); f.prepare(); f.schedule(); f.review();
    const approved = f.response.read(); const sourceBefore = f.source.read();
    f.operate('transfer', 'evidence-1', 'request-transfer', 'actor-2', { recipient: 'Maya Hassan', reason });
    expect(() => f.dispatch()).toThrow('pending custody'); expect(f.response.read()).toEqual(approved);
    f.operate('receipt', 'transfer-1', 'accept-transfer', 'actor-0', { note: reason });
    expect(() => f.dispatch()).toThrow('custody changed'); expect(f.response.read()).toEqual(approved);
    const pin = readRegulatoryIncidentEvidence(f.source.read(), 'incident-1', 'evidence-1', reason);
    f.response.dispatch({ id: 'correction', expectedRevision: approved.revision, role: 'Compliance Analyst', responseId: 'REG-FCA-204', evidenceIds: ['EVD-DEVICE-7', 'external-acquisition-report'], amendmentEvidence: null, reason, preparedBy: 'Compliance analyst', preparedOn: '2026-10-20T18:00:00Z', casePreparation: true, incidentEvidence: pin });
    f.review('corrected-review'); const complete = f.dispatch();
    expect(complete.casePreparations[0]).toEqual(approved.casePreparations[0]);
    expect(complete.casePreparations[1]).toMatchObject({ previousPreparationId: 'prepare', incidentEvidence: { custodianId: 'actor-0', acknowledgementId: 'receipt-1' } });
    expect(complete.dispatchAttempts[0]).toMatchObject({ preparationId: 'correction', legalReviewId: 'corrected-review' });
    expect(f.source.read().entities.find(item => item.id === 'evidence-1')?.fields['sha256']).toBe(sourceBefore.entities.find(item => item.id === 'evidence-1')?.fields['sha256']);
  });
  it('rejects missing, unrelated, unsealed and unavailable source records without inventing relationships', () => {
    const f = fixture(), source = f.source.read();
    expect(() => readRegulatoryIncidentEvidence(undefined, 'incident-1', 'evidence-1', reason)).toThrow('unavailable');
    expect(() => readRegulatoryIncidentEvidence(source, 'absent', 'evidence-1', reason)).toThrow('unrelated');
    const other = structuredClone(source); other.entities.push({ id: 'incident-2', kind: 'incident', title: 'Other', revision: 1, status: 'triage', fields: {} });
    expect(() => readRegulatoryIncidentEvidence(other, 'incident-2', 'evidence-1', reason)).toThrow('unrelated');
    const item = source.entities.find(row => row.id === 'evidence-1'); if (!item) throw new Error('Missing seed'); item.status = 'quarantined';
    expect(() => readRegulatoryIncidentEvidence(source, 'incident-1', 'evidence-1', reason)).toThrow('sealed');
  });
  it('blocks stale preparation and independent approval, but permits return without changing original evidence', () => {
    const f = fixture(); f.prepare(); f.schedule(); const before = f.response.read();
    f.operate('quarantine', 'evidence-1', 'integrity-observe', 'actor-2', { observed: 'sha256:ffffffff', note: reason });
    expect(() => f.review()).toThrow('sealed'); expect(f.response.read()).toEqual(before);
    const returned = f.review('returned', 'returned'); expect(returned.caseLegalReviews[0]?.decision).toBe('returned');
    expect(returned.casePreparations).toEqual(before.casePreparations);
    const pin = before.casePreparations[0]?.incidentEvidence;
    expect(() => f.response.dispatch({ id: 'stale-prep', expectedRevision: returned.revision, role: 'Compliance Analyst', responseId: 'REG-FCA-204', evidenceIds: [], amendmentEvidence: null, reason, preparedBy: 'analyst', preparedOn: '2026-10-20T18:00:00Z', casePreparation: true, ...(pin ? { incidentEvidence: pin } : {}) })).toThrow('sealed');
  });
  it('does not allow removal of a bound source or bypass through an unavailable source adapter', () => {
    const f = fixture(); f.prepare(); f.schedule(); const current = f.response.read();
    expect(() => f.response.dispatch({ id: 'remove', expectedRevision: current.revision, role: 'Compliance Analyst', responseId: 'REG-FCA-204', evidenceIds: [], amendmentEvidence: null, reason, preparedBy: 'analyst', preparedOn: '2026-10-20T18:00:00Z', casePreparation: true })).toThrow('cannot discard');
    const unavailable = new RegulatorResponseRepository(localStorage);
    expect(() => unavailable.dispatch({ id: 'review', expectedRevision: current.revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', preparationId: 'prepare', decision: 'approved', rationale: reason, reviewer: 'Privacy counsel', reviewedOn: '2026-10-20T18:00:00Z', caseLegalReview: true })).toThrow('unavailable');
    expect(f.response.read()).toEqual(current);
  });
  it('keeps legacy external preparations loadable and does not invalidate delivered evidence after later custody activity', () => {
    const f = fixture(); f.prepare(); f.schedule(); f.review(); const sent = f.dispatch();
    f.operate('quarantine', 'evidence-1', 'integrity-observe', 'actor-2', { observed: 'sha256:ffffffff', note: reason });
    const closed = f.response.dispatch({ id: 'close', expectedRevision: sent.revision, role: 'Compliance Lead', responseId: 'REG-FCA-204', evidenceIds: ['EVD-DEVICE-7', 'external-acquisition-report'], legalApproval: 'review', complianceApproval: 'close', releaseReference: 'RELEASE-SOURCE', dispatchEvidence: 'RECEIPT-001', regulatorAcknowledgement: 'REGULATOR-ACK', outstandingFollowUps: 0, closedBy: 'Compliance lead', closedOn: '2026-10-20T20:00:00Z' });
    expect(closed.casePreparations).toEqual(sent.casePreparations);
    const legacy = structuredClone(sent); for (const row of legacy.casePreparations) delete row.incidentEvidence;
    localStorage.setItem(BrowserRegulatorResponsePersistence.key, JSON.stringify(legacy));
    expect(new RegulatorResponseRepository(localStorage).read().casePreparations[0]).not.toHaveProperty('incidentEvidence');
  });
  it('isolates unavailable incident data from external cases and recovers without resetting case history', async () => {
    const f = fixture(), original = localStorage.getItem(f.source.key);
    localStorage.setItem(f.source.key, '{invalid');
    render(<RegulatorResponseControl />);
    expect(screen.getByLabelText('Incident source readiness')).toHaveTextContent('Incident workspace unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Prepare case release evidence' }));
    expect(f.response.read().casePreparations).toHaveLength(1);
    expect(f.response.read().casePreparations[0]).not.toHaveProperty('incidentEvidence');
    if (!original) throw new Error('Missing authoritative fixture');
    localStorage.setItem(f.source.key, original);
    fireEvent.click(screen.getByText('Authoritative incident evidence'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh incident sources' }));
    expect(screen.getByRole('option', { name: 'incident-1 · Endpoint compromise investigation' })).toBeInTheDocument();
    expect(f.response.read().casePreparations).toHaveLength(1);
    await waitFor(() => { expect(screen.getByRole('status')).toHaveFocus(); });
  });
  it('preserves operator selection and input, announces failure, and focuses recoverable source feedback', async () => {
    const f = fixture(); render(<RegulatorResponseControl />);
    fireEvent.click(screen.getByText('Authoritative incident evidence'));
    fireEvent.change(screen.getByLabelText('Source incident', { exact: true }), { target: { value: 'incident-1' } });
    fireEvent.change(screen.getByLabelText('Source incident evidence', { exact: true }), { target: { value: 'evidence-1' } });
    fireEvent.change(screen.getByLabelText('Incident association reason'), { target: { value: reason } });
    f.operate('changed', 'evidence-1', 'integrity-observe', 'actor-2', { observed: 'sha256:ffffffff', note: reason });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare case release evidence' }));
    expect(screen.getByRole('status')).toHaveTextContent('sealed');
    expect(screen.getByLabelText('Incident association reason')).toHaveValue(reason);
    expect(screen.getByLabelText('Source incident evidence', { exact: true })).toHaveValue('evidence-1');
    expect(f.response.read().casePreparations).toHaveLength(0);
    await waitFor(() => { expect(screen.getByRole('status')).toHaveFocus(); });
  });
});
