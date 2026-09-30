import { useEffect, useRef, useState } from "react";
import { regulatorResponseReadiness } from "./regulator-readiness";
import {
  acknowledgementDeadline,
  compareRegulatorFollowUpDrafts,
  correctionAssignment,
  getDispatchRecoveryStatus,
  getRegulatoryFollowUpReviewReadiness,
  getRegulatoryFollowUpObligations,
  regulatoryCaseIntegrity,
  RegulatorResponseRepository,
  type RegulatorControlRole,
  type RegulatoryFollowUpStage,
  type RegulatoryFollowUpEvent,
} from "./regulator-response-domain";

interface CaseInput { reviewer: string; reviewOn: string; evidence: string; amendment: string; reason: string; legalRationale: string; release: string; dispatch: string; acknowledgement: string }
interface ObligationInput { draft: { requested: string; statement: string; evidence: string; reason: string; owner: string }; rationale: string; stageEvidence: string }
function readObligationInputs(): Record<string, ObligationInput> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('sentinelarc:regulatory-work-input:v1') ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, ObligationInput] => { const value: unknown = entry[1]; if (!value || typeof value !== 'object' || !('draft' in value) || !value.draft || typeof value.draft !== 'object' || !('rationale' in value) || typeof value.rationale !== 'string' || !('stageEvidence' in value) || typeof value.stageEvidence !== 'string') return false; const draft = value.draft; return ['requested', 'statement', 'evidence', 'reason', 'owner'].every((key) => key in draft && typeof (draft as Record<string, unknown>)[key] === 'string'); }));
  } catch { return {}; }
}
interface RequestInput { id: string; type: RegulatoryFollowUpEvent['obligationType']; deadline: string; owner: string; reference: string }
function readRequestInputs(): Record<string, RequestInput> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('sentinelarc:regulatory-request-input:v1') ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, RequestInput] => { const value: unknown = entry[1]; if (!value || typeof value !== 'object') return false; const fields = value as Record<string, unknown>; return ['id', 'deadline', 'owner', 'reference'].every((key) => typeof fields[key] === 'string') && ['information-request', 'remediation-update', 'evidence-supplement'].includes(String(fields['type'])); }));
  } catch { return {}; }
}
export function RegulatorResponseControl() {
  const [repository] = useState(
    () => new RegulatorResponseRepository(localStorage),
  );
  const [state, setState] = useState(() => repository.read());
  const [role, setRole] = useState<RegulatorControlRole>("Compliance Analyst");
  const [message, setMessage] = useState("");
  const [releaseCaseId, setReleaseCaseId] = useState('REG-FCA-204');
  const [caseInputs, setCaseInputs] = useState<Record<string, CaseInput>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('sentinelarc:case-release-input:v1') ?? '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, CaseInput] => {
        const value: unknown = entry[1];
        return Boolean(value && typeof value === 'object' && ['reviewer', 'reviewOn', 'evidence', 'amendment', 'reason', 'legalRationale', 'release', 'dispatch', 'acknowledgement'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string'));
      }));
    } catch { return {}; }
  });
  const legacyRelease = releaseCaseId === 'REG-FCA-204';
  const selectedResponse = state.responses.find((item) => item.responseId === releaseCaseId);
  const caseInput = caseInputs[releaseCaseId] ?? { reviewer: legacyRelease ? 'Senior privacy counsel' : (selectedResponse?.regulator ?? 'Regulatory') + ' privacy counsel', reviewOn: legacyRelease ? '2026-10-20T18:00:00Z' : '2026-10-22T18:00:00Z', evidence: legacyRelease ? 'EVD-DEVICE-7' : '', amendment: '', reason: 'Evidence and source amendments are prepared for independent regulatory review.', legalRationale: 'The source package satisfies the case-specific evidence and amendment obligations.', release: legacyRelease ? 'RELEASE-204-R1' : '', dispatch: legacyRelease ? 'DISPATCH-FCA-204' : '', acknowledgement: legacyRelease ? 'ACK-FCA-204' : '' };
  const updateCaseInput = (field: keyof CaseInput, value: string) => { setCaseInputs((current) => ({ ...current, [releaseCaseId]: { ...caseInput, ...current[releaseCaseId], [field]: value } })); };
  useEffect(() => { localStorage.setItem('sentinelarc:case-release-input:v1', JSON.stringify(caseInputs)); }, [caseInputs]);
  const currentLegalReviewSchedule = state.reviewHistory.filter((item) => item.responseId === releaseCaseId).at(-1);
  const currentCasePreparation = state.casePreparations.filter((item) => item.responseId === releaseCaseId).at(-1);
  const currentCaseLegalReview = state.caseLegalReviews.filter((item) => item.responseId === releaseCaseId).at(-1);
  const currentCaseAttempts = state.dispatchAttempts.filter((item) => item.responseId === releaseCaseId && item.releaseReference === caseInput.release);
  const governedRelease = !legacyRelease || Boolean(currentCasePreparation);
  const legalReleaseReady = !governedRelease || (currentCaseLegalReview?.decision === 'approved' && currentCaseLegalReview.preparationId === currentCasePreparation?.id && currentCaseLegalReview.reviewChangeId === currentLegalReviewSchedule?.id);
  const caseBusinessTime = (fallback: string) => [fallback, ...state.casePreparations.filter((item) => item.responseId === releaseCaseId).map((item) => item.preparedOn), ...state.caseLegalReviews.filter((item) => item.responseId === releaseCaseId).map((item) => item.reviewedOn), ...state.dispatchAttempts.filter((item) => item.responseId === releaseCaseId).map((item) => item.attemptedOn)].sort().at(-1) ?? fallback;
  const prepareCase = () => {
    try {
      setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, responseId: releaseCaseId, casePreparation: true, evidenceIds: caseInput.evidence.split(',').map((item) => item.trim()).filter(Boolean), amendmentEvidence: caseInput.amendment || null, reason: caseInput.reason, preparedBy: role, preparedOn: caseBusinessTime('2026-10-20T18:00:00Z') }));
      setMessage('Case-specific source evidence prepared; independent legal release review is required.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Case preparation failed.'); }
  };
  const reviewCase = (decision: 'approved' | 'returned') => {
    if (!currentCasePreparation) return;
    try {
      setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, responseId: releaseCaseId, caseLegalReview: true, preparationId: currentCasePreparation.id, decision, rationale: caseInput.legalRationale, reviewer: currentLegalReviewSchedule?.reviewer ?? '', reviewedOn: caseBusinessTime(currentLegalReviewSchedule?.reviewOn ?? '2026-10-20T18:00:00Z') }));
      setMessage(decision === 'approved' ? 'Current case source evidence independently approved for release.' : 'Current case source evidence returned; correction must preserve the prior legal decision.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Case legal review failed.'); }
  };
  const [archiveCaseId, setArchiveCaseId] = useState('REG-FCA-204');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [followUpCaseId, setFollowUpCaseId] = useState('REG-FCA-204');
  const [selectedObligations, setSelectedObligations] = useState<Record<string, string>>({});
  const [workInputs, setWorkInputs] = useState(readObligationInputs);
  const [requestInputs, setRequestInputs] = useState(readRequestInputs);
  const requestInput = requestInputs[followUpCaseId] ?? { id: '', type: 'information-request' as const, deadline: '2026-10-30', owner: 'Regulatory liaison', reference: '' };
  const { id: newObligationId, type: newObligationType, deadline: newObligationDeadline, owner: newObligationOwner, reference: requestReference } = requestInput;
  const updateRequest = <K extends keyof RequestInput,>(field: K, value: RequestInput[K]) => { setRequestInputs((current) => ({ ...current, [followUpCaseId]: { ...requestInput, ...current[followUpCaseId], [field]: value } })); };
  useEffect(() => { localStorage.setItem('sentinelarc:regulatory-request-input:v1', JSON.stringify(requestInputs)); }, [requestInputs]);
  const followUps = getRegulatoryFollowUpObligations(state, '2026-10-29').filter((item) => item.responseId === followUpCaseId);
  const obligationId = selectedObligations[followUpCaseId] ?? followUps[0]?.obligationId ?? (followUpCaseId === 'REG-FCA-204' ? 'OBL-204-A' : `OBL-${followUpCaseId}-A`);
  const selectedObligation = followUps.find((item) => item.obligationId === obligationId);
  const inputKey = `${followUpCaseId}:${obligationId}`;
  const isLegacyObligation = followUpCaseId === 'REG-FCA-204' && obligationId === 'OBL-204-A';
  const input = workInputs[inputKey] ?? { draft: { requested: isLegacyObligation ? 'Provide current sealed device evidence' : '', statement: isLegacyObligation ? 'The corrected device evidence confirms the containment sequence.' : '', evidence: isLegacyObligation ? 'EVD-DEVICE-7' : '', reason: '', owner: selectedObligation?.owner ?? 'Regulatory liaison' }, rationale: 'Evidence matches the acknowledged release and obligation request.', stageEvidence: '' };
  const draft = input.draft;
  const setDraft = (value: ObligationInput['draft'] | ((current: ObligationInput['draft']) => ObligationInput['draft'])) => { setWorkInputs((current) => ({ ...current, [inputKey]: { ...input, ...current[inputKey], draft: typeof value === 'function' ? value(current[inputKey]?.draft ?? draft) : value } })); };
  const reviewRationale = input.rationale;
  const setReviewRationale = (rationale: string) => { setWorkInputs((current) => ({ ...current, [inputKey]: { ...input, ...current[inputKey], rationale } })); };
  const followUpStageEvidence = input.stageEvidence;
  const setFollowUpStageEvidence = (stageEvidence: string) => { setWorkInputs((current) => ({ ...current, [inputKey]: { ...input, ...current[inputKey], stageEvidence } })); };
  const followUpClosure = state.closures.filter((item) => item.responseId === followUpCaseId).at(-1);
  const followUpRelease = selectedObligation?.releaseReference ?? followUpClosure?.releaseReference ?? 'RELEASE-204-R1';
  const obligationType = selectedObligation?.obligationType ?? 'evidence-supplement';
  const selectedCorrectionIds = new Set(state.correctionRequests.filter((item) => item.obligationId === obligationId).map((item) => item.id));
  useEffect(() => { localStorage.setItem('sentinelarc:regulatory-work-input:v1', JSON.stringify(workInputs)); }, [workInputs]);

  const [replacementOwner, setReplacementOwner] = useState("Senior regulatory liaison");
  const [reserveOwner, setReserveOwner] = useState("Regulatory duty manager");
  const [higherAuthority, setHigherAuthority] = useState('Senior compliance lead');
  const [alternateAuthority, setAlternateAuthority] = useState('Duty compliance lead');
  const [authorityWindow, setAuthorityWindow] = useState(1);
  const [escalationReason, setEscalationReason] = useState("Original correction deadline passed without the required custody evidence.");
  const feedback = useRef<HTMLParagraphElement>(null);
  const readiness = regulatorResponseReadiness(state.responses, "2026-10-20");
  const archiveIssues = regulatoryCaseIntegrity(state, archiveCaseId);
  const selectedArchive = state.caseArchives.find((item) => item.id === selectedArchiveId) ?? state.caseArchives.filter((item) => item.responseId === archiveCaseId).at(-1);
  const captureArchive = () => { try { const id = crypto.randomUUID(); setState(repository.captureArchive({ id, expectedRevision: state.revision, responseId: archiveCaseId, role, createdBy: 'Compliance lead', createdOn: '2026-10-29' })); setSelectedArchiveId(id); setMessage('Regulatory case archive captured with verified release and correction lineage.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Case archive failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recovery = getDispatchRecoveryStatus(
    state,
    releaseCaseId,
    caseInput.release,
  );

  const operationDay = () => ['2026-10-26', ...state.followUpEvents.filter((item) => item.obligationId === obligationId).map((item) => item.occurredOn.slice(0, 10)), ...state.followUpDrafts.filter((item) => item.obligationId === obligationId).map((item) => item.draftedOn.slice(0, 10)), ...state.followUpReviews.filter((item) => item.obligationId === obligationId).map((item) => item.reviewedOn.slice(0, 10)), ...state.correctionSchedule.filter((item) => selectedCorrectionIds.has(item.correctionRequestId)).map((item) => item.escalatedOn.slice(0, 10))].sort().at(-1) ?? '2026-10-26';
  const createObligation = () => { try { const createdId = newObligationId.trim(); setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: createdId, responseId: followUpCaseId, releaseReference: followUpRelease, requiresReviewedDraft: true, obligationType: newObligationType, deadline: newObligationDeadline, owner: newObligationOwner.trim(), stage: 'opened', evidenceReference: requestReference, actor: 'Compliance lead', occurredOn: '2026-10-26' })); setSelectedObligations((current) => ({ ...current, [followUpCaseId]: createdId })); setMessage('Regulator request opened against its exact acknowledged release; independent draft review is required.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Regulator request could not be opened.'); } queueMicrotask(() => feedback.current?.focus()); };
  const draftComparison = compareRegulatorFollowUpDrafts(state, obligationId);
  const followUpReadiness = getRegulatoryFollowUpReviewReadiness(state, obligationId);
  const prepareFollowUp = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId, requestedInformation: draft.requested, responseStatement: draft.statement, evidenceReferences: draft.evidence.split(",").map((item) => item.trim()).filter(Boolean), amendmentReason: draft.reason || null, owner: draft.owner, draftedBy: selectedObligation?.history.some((item) => item.requiresReviewedDraft) ? role : "Compliance analyst", draftedOn: [operationDay(), state.correctionSchedule.some((item) => selectedCorrectionIds.has(item.correctionRequestId)) ? "2026-10-30" : "2026-10-26"].sort().at(-1) ?? "2026-10-26" })); setMessage("Obligation-specific response draft preserved for review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Follow-up drafting failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewFollowUp = (decision: 'approved' | 'returned') => { if (!draftComparison) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId, draftId: draftComparison.current.id, decision, rationale: reviewRationale, reviewer: 'Compliance lead', reviewedOn: operationDay() })); setMessage(decision === 'approved' ? 'Latest response draft approved for obligation release.' : 'Response draft returned for correction; prior evidence remains preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow-up review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const activeCorrection = state.correctionRequests.filter((item) => item.obligationId === obligationId).at(-1);
  const currentAuthorityPolicy = state.authorityPolicies.filter((item) => item.obligationType === obligationType).at(-1);
  const pinnedAuthorityPolicy = state.authorityPolicies.find((item) => item.id === activeCorrection?.authorityPolicyId);
  const correctionOwner = activeCorrection ? correctionAssignment(state, activeCorrection.id) : null;
  const pendingCorrectionSchedule = state.correctionSchedule.find((item) => item.id === correctionOwner?.pendingScheduleId);
  const reviseAuthority = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationType, effectiveOn: '2026-10-25', primaryAuthority: higherAuthority, nextAuthority: alternateAuthority, acknowledgementDays: authorityWindow, approvedBy: 'Compliance lead' })); setMessage('Correction authority policy revised for future returned reviews.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Authority policy revision failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const escalateCorrection = () => { if (!activeCorrection) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, correctionRequestId: activeCorrection.id, owner: replacementOwner, dueOn: '2026-10-31', acknowledgementDueOn: acknowledgementDeadline('2026-10-29', pinnedAuthorityPolicy?.acknowledgementDays ?? 1), higherAuthority: pinnedAuthorityPolicy?.primaryAuthority ?? higherAuthority, reason: escalationReason, evidenceReference: 'CORRECTION-ESCALATION-204', escalatedBy: 'Compliance lead', escalatedOn: '2026-10-29' })); setMessage('Overdue correction escalated; higher authority must acknowledge before ownership transfers.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Correction escalation failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const acknowledgeEscalation = () => { if (!correctionOwner?.pendingScheduleId || !correctionOwner.pendingOwner) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, scheduleId: correctionOwner.pendingScheduleId, owner: correctionOwner.pendingOwner, evidenceReference: 'CORRECTION-HANDOFF-ACK-204', acknowledgedBy: pendingCorrectionSchedule?.higherAuthority ?? correctionOwner.pendingOwner, acknowledgedOn: pendingCorrectionSchedule?.escalatedOn ?? '2026-10-29' })); setDraft((current) => ({ ...current, owner: correctionOwner.pendingOwner ?? current.owner })); setMessage('Designated authority acknowledged the handoff; replacement owner now holds correction responsibility.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Correction handoff failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recoverUnacknowledged = () => { if (!pendingCorrectionSchedule) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, scheduleId: pendingCorrectionSchedule.id, replacementOwner: reserveOwner, dueOn: '2026-11-05', acknowledgementDueOn: acknowledgementDeadline('2026-11-01', pinnedAuthorityPolicy?.acknowledgementDays ?? 2), higherAuthority: pinnedAuthorityPolicy?.nextAuthority ?? alternateAuthority, reason: 'Replacement owner did not acknowledge the correction handoff by its deadline.', evidenceReference: 'UNACKNOWLEDGED-HANDOFF-204', escalatedBy: 'Compliance lead', asOf: '2026-11-01' })); setMessage('Overdue unacknowledged handoff reassigned; original owner remains accountable until the new handoff is acknowledged.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Handoff recovery failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const followUpAuthority = () => { if (!pendingCorrectionSchedule) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, scheduleId: pendingCorrectionSchedule.id, asOf: '2026-10-31', evidenceReference: 'AUTHORITY-REMINDER-204', recordedBy: 'Compliance lead' })); setMessage('Higher-authority follow-up recorded; correction ownership has not transferred.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Authority follow-up failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reschedule = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          responseId: releaseCaseId,
          reviewer: caseInput.reviewer,
          reviewOn: caseInput.reviewOn,
          asOf: "2026-10-20T09:00:00Z",
          reason:
            "Evidence blocker requires senior counsel review before deadline.",
        }),
      );
      setMessage(
        "Legal review reassigned and rescheduled before the response deadline.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Legal review scheduling failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const dispatch = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          responseId: releaseCaseId,
          releaseReference: caseInput.release,
          releaseRevision: state.revision,
          status: "succeeded",
          failureClassification: null,
          retryEligible: false,
          actor: "Compliance dispatch service",
          attemptedOn: caseBusinessTime('2026-10-20T19:30:00Z'),
          retryOf: null,
          dispatchEvidence: caseInput.dispatch,
        }),
      );
      setMessage(
        "Approved regulator response dispatched with durable evidence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Regulator dispatch failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const failDispatch = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          responseId: releaseCaseId,
          releaseReference: caseInput.release,
          releaseRevision: state.revision,
          status: "failed",
          failureClassification: "regulator-gateway-timeout",
          retryEligible: true,
          actor: "Compliance dispatch service",
          attemptedOn: caseBusinessTime('2026-10-20T19:25:00Z'),
          retryOf: null,
          dispatchEvidence: null,
        }),
      );
      setMessage(
        "Dispatch failure recorded. The approved release can be retried without losing evidence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Dispatch failure could not be recorded.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const retryDispatch = () => {
    const failed = recovery.latest;
    if (!failed) return;
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          responseId: releaseCaseId,
          releaseReference: failed.releaseReference,
          releaseRevision: failed.releaseRevision,
          status: "succeeded",
          failureClassification: null,
          retryEligible: false,
          actor: "Compliance dispatch service",
          attemptedOn: caseBusinessTime('2026-10-20T19:35:00Z'),
          retryOf: failed.id,
          dispatchEvidence: caseInput.dispatch,
        }),
      );
      setMessage(
        "Approved regulator response dispatched on retry with durable evidence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Regulator dispatch retry failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const close = () => {
    try {
      const closureId = crypto.randomUUID();
      setState(
        repository.dispatch({
          id: closureId,
          expectedRevision: state.revision,
          role,
          responseId: releaseCaseId,
          evidenceIds: currentCasePreparation?.evidenceIds ?? caseInput.evidence.split(',').map((item) => item.trim()).filter(Boolean),
          legalApproval: currentCaseLegalReview?.id ?? (legacyRelease ? "LEGAL-APP-204" : ""),
          complianceApproval: closureId,
          releaseReference: caseInput.release,
          dispatchEvidence: caseInput.dispatch,
          regulatorAcknowledgement: caseInput.acknowledgement,
          outstandingFollowUps: 0,
          closedBy: "Compliance lead",
          closedOn: caseBusinessTime('2026-10-20T20:00:00Z'),
        }),
      );
      setMessage(
        "Regulatory obligation closed after independent approval, dispatch, and acknowledgement.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Regulatory closure failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };

  const renewFollowUpApproval = () => { if (!draftComparison) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId, responseId: followUpCaseId, releaseReference: followUpRelease, obligationType, deadline: selectedObligation?.deadline ?? '2026-10-28', owner: selectedObligation?.owner ?? 'Regulatory liaison', stage: 'approved', evidenceReference: draftComparison.current.id, actor: 'Compliance lead', occurredOn: operationDay() })); setMessage('Follow-up approval renewed for the corrected draft; original approval remains historical.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Renewed approval failed.'); } queueMicrotask(() => feedback.current?.focus()); };  const advanceFollowUp = () => { const stages: RegulatoryFollowUpStage[] = ["opened", "drafted", "approved", "dispatched", "acknowledged", "closed"]; const history = state.followUpEvents.filter((item) => item.obligationId === obligationId); const previousStage = history.at(-1)?.stage; const stage = stages[previousStage ? stages.indexOf(previousStage) + 1 : 0]; if (!stage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, ...(stage === 'opened' && !isLegacyObligation ? { requiresReviewedDraft: true as const } : {}), obligationId, responseId: followUpCaseId, releaseReference: followUpRelease, obligationType, deadline: selectedObligation?.deadline ?? "2026-10-28", owner: selectedObligation?.owner ?? "Regulatory liaison", stage, evidenceReference: stage === "approved" && draftComparison ? draftComparison.current.id : draftComparison && ["dispatched", "acknowledged", "closed"].includes(stage) ? followUpStageEvidence : `FOLLOWUP-${stage}`, actor: "Compliance lead", occurredOn: operationDay() })); setMessage(`Regulator follow-up ${stage}.`); setFollowUpStageEvidence(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Follow-up update failed."); } queueMicrotask(() => feedback.current?.focus()); };
  return (
    <section className="card" aria-label="Regulator response readiness">
      <h2>Regulator response readiness</h2>
      <section aria-label="Case release control">
        <h3>Source preparation and legal release</h3>
        <label>Active release case<select value={releaseCaseId} onChange={(event) => { setReleaseCaseId(event.target.value); }}>{state.responses.map((item) => <option key={item.responseId} value={item.responseId}>{item.responseId} · {item.regulator}</option>)}</select></label>
        <p>{selectedResponse?.regulator} · deadline {selectedResponse?.deadline} · {selectedResponse?.released ? 'acknowledged release' : 'open release'} · {governedRelease ? 'independent source review required' : 'Legacy FCA release attribution retained; record source preparation to use governed review.'}</p>
        <label>Legal review owner<input value={caseInput.reviewer} onChange={(event) => { updateCaseInput('reviewer', event.target.value); }} /></label>
        <label>Legal review business timestamp<input value={caseInput.reviewOn} onChange={(event) => { updateCaseInput('reviewOn', event.target.value); }} /></label>
        <label>Case source evidence<input value={caseInput.evidence} onChange={(event) => { updateCaseInput('evidence', event.target.value); }} /></label>
        <label>Case amendment evidence<input value={caseInput.amendment} onChange={(event) => { updateCaseInput('amendment', event.target.value); }} /></label>
        <label>Case preparation reason<textarea value={caseInput.reason} onChange={(event) => { updateCaseInput('reason', event.target.value); }} /></label>
        <button disabled={role !== 'Compliance Analyst' || (selectedResponse?.released ?? true) || currentCaseAttempts.some((item) => item.status === 'succeeded')} onClick={prepareCase}>Prepare case release evidence</button>
        <label>Case legal review rationale<textarea value={caseInput.legalRationale} onChange={(event) => { updateCaseInput('legalRationale', event.target.value); }} /></label>
        <button disabled={role !== 'Compliance Lead' || !currentLegalReviewSchedule || !currentCasePreparation || currentCaseLegalReview?.preparationId === currentCasePreparation.id && currentCaseLegalReview.reviewChangeId === currentLegalReviewSchedule.id} onClick={() => { reviewCase('approved'); }}>Approve case release evidence</button>
        <button disabled={role !== 'Compliance Lead' || !currentLegalReviewSchedule || !currentCasePreparation || currentCaseLegalReview?.preparationId === currentCasePreparation.id && currentCaseLegalReview.reviewChangeId === currentLegalReviewSchedule.id} onClick={() => { reviewCase('returned'); }}>Return case release evidence</button>
        <label>Case release reference<input value={caseInput.release} onChange={(event) => { updateCaseInput('release', event.target.value); }} /></label>
        <label>Case dispatch evidence<input value={caseInput.dispatch} onChange={(event) => { updateCaseInput('dispatch', event.target.value); }} /></label>
        <label>Case regulator acknowledgement<input value={caseInput.acknowledgement} onChange={(event) => { updateCaseInput('acknowledgement', event.target.value); }} /></label>
        <ol aria-label="Case preparation history">{state.casePreparations.filter((item) => item.responseId === releaseCaseId).map((item) => <li key={item.id}>{item.id} · {item.evidenceIds.join(', ')} · amendment {item.amendmentEvidence ?? 'not required'} · {item.preparedBy} · {item.preparedOn}</li>)}</ol>
        <ol aria-label="Case legal release decisions">{state.caseLegalReviews.filter((item) => item.responseId === releaseCaseId).map((item) => <li key={item.id}>{item.preparationId} · {item.decision} · {item.reviewer} · {item.rationale}</li>)}</ol>
      </section>

      <label>
        Response control role
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value as RegulatorControlRole);
          }}
        >
          <option>Compliance Analyst</option>
          <option>Compliance Lead</option>
        </select>
      </label>
      {readiness.map((item) => (
        <p key={item.responseId}>
          {item.responseId} · {item.regulator} · {item.priority} ·{" "}
          {item.blockers.join(", ") || "clear"}
        </p>
      ))}
      <section aria-label="Regulatory case evidence archive"><h3>Case evidence archive</h3><label>Regulatory case<select value={archiveCaseId} onChange={(event) => { setArchiveCaseId(event.target.value); setSelectedArchiveId(null); }}>{state.responses.map((item) => <option key={item.responseId} value={item.responseId}>{item.responseId}</option>)}</select></label><p aria-label="Regulatory archive integrity">{archiveIssues.length ? archiveIssues.join(' ') : 'Release, dispatch, follow-up, and correction lineage verified.'}</p><button disabled={role !== 'Compliance Lead' || archiveIssues.length > 0} onClick={captureArchive}>Capture regulatory case archive</button><ol aria-label="Regulatory case archive history">{state.caseArchives.filter((item) => item.responseId === archiveCaseId).map((item) => <li key={item.id}><button aria-pressed={selectedArchive?.id === item.id} onClick={() => { setSelectedArchiveId(item.id); }}>{item.responseId} · {item.createdOn} · revision {item.sourceRevision}</button></li>)}</ol>{selectedArchive && <div aria-label="Selected regulatory case archive"><p>Archive {selectedArchive.id} · schema {selectedArchive.schemaVersion} · case {selectedArchive.responseId} · source revision {selectedArchive.sourceRevision}</p><p>{selectedArchive.closures.length} acknowledged releases · {selectedArchive.dispatchAttempts.length} dispatch attempts · {selectedArchive.followUpEvents.length} follow-up events · {selectedArchive.correctionRequests.length} correction requests</p><p>{selectedArchive.authorityPolicies ? `${String(selectedArchive.authorityPolicies.length)} pinned authority policy revisions · ${String(selectedArchive.legacyEffectiveScheduleIds?.length ?? 0)} legacy effective schedules` : 'Authority policy evidence was not included in this legacy archive.'}</p><a download={`regulatory-case-${selectedArchive.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedArchive, null, 2))}`}>Download selected case archive</a></div>}</section>
      <button
        disabled={role !== "Compliance Lead" || state.reviewHistory.length > 0}
        onClick={reschedule}
      >
        Reassign urgent legal review
      </button>
      <button
        disabled={
          role !== "Compliance Lead" || !legalReleaseReady ||
          !currentLegalReviewSchedule ||
          currentCaseAttempts.length > 0
        }
        onClick={dispatch}
      >
        Dispatch approved response
      </button>
      <button
        disabled={
          role !== "Compliance Lead" ||
          !legalReleaseReady ||
          !currentLegalReviewSchedule ||
          currentCaseAttempts.length > 0
        }
        onClick={failDispatch}
      >
        Record retryable dispatch failure
      </button>
      <button
        disabled={role !== "Compliance Lead" || !recovery.canRetry}
        onClick={retryDispatch}
      >
        Retry approved response
      </button>
      <p>
        Dispatch attempts remaining: {recovery.attemptsRemaining} ·{" "}
        {recovery.superseded
          ? `superseded by ${recovery.supersededByReleaseReference ?? "a newer release"}`
          : recovery.canRetry
            ? "retry valid"
            : "no retry pending"}
      </p>
      <button
        disabled={
          role !== "Compliance Lead" ||
          !legalReleaseReady ||
          !currentCaseAttempts.some((item) => item.status === "succeeded") ||
          state.closures.some((item) => item.responseId === releaseCaseId)
        }
        onClick={close}
      >
        Acknowledge and close response
      </button>
      {draftComparison && ['approved', 'dispatched', 'acknowledged'].includes(selectedObligation?.status ?? '') && <section aria-label="Follow-up execution evidence"><h3>Execute the reviewed response</h3><p>The next dispatch, acknowledgement or closure must supply its own durable evidence. The reviewed response version remains pinned.</p><label>Follow-up stage evidence<input value={followUpStageEvidence} onChange={(event) => { setFollowUpStageEvidence(event.target.value); }} /></label></section>}      {draftComparison && selectedObligation?.status === 'approved' && state.followUpEvents.filter((item) => item.obligationId === obligationId && item.stage === 'approved').at(-1)?.evidenceReference !== draftComparison.current.id && <button disabled={role !== 'Compliance Lead'} onClick={renewFollowUpApproval}>Renew follow-up approval</button>}      <button disabled={role !== "Compliance Lead" || !followUpClosure || (!selectedObligation && !isLegacyObligation) || followUps.some((item) => item.obligationId === obligationId && item.status === "closed")} onClick={advanceFollowUp}>Advance regulator follow-up</button>
      <section aria-label="Acknowledged release follow-up work"><h3>Governed regulator requests</h3><label>Follow-up acknowledged case<select value={followUpCaseId} onChange={(event) => { setFollowUpCaseId(event.target.value); setMessage(''); }}>{state.closures.length === 0 ? <option value="REG-FCA-204">REG-FCA-204 · acknowledgement required</option> : [...new Set(state.closures.map((item) => item.responseId))].map((id) => <option key={id} value={id}>{id}</option>)}</select></label><label>Active follow-up obligation<select value={obligationId} onChange={(event) => { setSelectedObligations((current) => ({ ...current, [followUpCaseId]: event.target.value })); setMessage(''); }}>{followUps.length === 0 ? <option value={obligationId}>{obligationId} · not opened</option> : followUps.map((item) => <option key={item.obligationId} value={item.obligationId}>{item.obligationId} · {item.obligationType}</option>)}</select></label><p aria-label="Selected follow-up obligation">{obligationId} · case {followUpCaseId} · acknowledged release {followUpRelease} · {selectedObligation?.status ?? 'not opened'} · owner {selectedObligation?.owner ?? 'unassigned'}</p><fieldset><legend>Open a regulator request</legend><label>New obligation ID<input value={newObligationId} onChange={(event) => { updateRequest("id", event.target.value); }} /></label><label>New obligation type<select value={newObligationType} onChange={(event) => { updateRequest('type', event.target.value as RegulatoryFollowUpEvent['obligationType']); }}><option value="information-request">Information request</option><option value="remediation-update">Remediation update</option><option value="evidence-supplement">Evidence supplement</option></select></label><label>New obligation deadline<input type="date" value={newObligationDeadline} onChange={(event) => { updateRequest("deadline", event.target.value); }} /></label><label>New obligation owner<input value={newObligationOwner} onChange={(event) => { updateRequest("owner", event.target.value); }} /></label><label>Regulator request evidence<input value={requestReference} onChange={(event) => { updateRequest("reference", event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || !followUpClosure} onClick={createObligation}>Open governed regulator request</button></fieldset></section>
      <fieldset><legend>Obligation response draft</legend><label>Requested regulator information<input value={draft.requested} onChange={(event) => { setDraft({ ...draft, requested: event.target.value }); }} /></label><label>Response statement<textarea value={draft.statement} onChange={(event) => { setDraft({ ...draft, statement: event.target.value }); }} /></label><label>Evidence references<input value={draft.evidence} onChange={(event) => { setDraft({ ...draft, evidence: event.target.value }); }} /></label><label>Amendment reason<input value={draft.reason} onChange={(event) => { setDraft({ ...draft, reason: event.target.value }); }} /></label><label>Response owner<input value={draft.owner} onChange={(event) => { setDraft({ ...draft, owner: event.target.value }); }} /></label><button disabled={followUps.length === 0 || !["opened", "drafted", "approved"].includes(selectedObligation?.status ?? "")} onClick={prepareFollowUp}>Save obligation draft</button></fieldset>
      {draftComparison && <section aria-label="Follow-up amendment comparison"><h3>Follow-up response versions</h3><p>Source release {draftComparison.current.sourceReleaseReference} · previous {draftComparison.previous?.id ?? "none"} · current {draftComparison.current.id} · correction {draftComparison.current.correctionRequestId ?? "none"}</p><p>Statement {draftComparison.previous?.responseStatement ?? "original notification"} → {draftComparison.current.responseStatement}</p><p>Added evidence {draftComparison.addedEvidence.join(", ") || "none"} · removed evidence {draftComparison.removedEvidence.join(", ") || "none"} · reason {draftComparison.amendmentReason ?? "initial draft"}</p></section>}
      <section aria-label="Correction authority policy"><h3>Correction authority schedule</h3><p>Current {obligationType} policy {currentAuthorityPolicy?.id ?? 'unavailable'} · effective {currentAuthorityPolicy?.effectiveOn ?? 'unavailable'}</p><label>Policy primary authority<input value={higherAuthority} onChange={(event) => { setHigherAuthority(event.target.value); }} /></label><label>Policy next authority<input value={alternateAuthority} onChange={(event) => { setAlternateAuthority(event.target.value); }} /></label><label>Authority acknowledgement days<input type="number" min="1" max="14" value={authorityWindow} onChange={(event) => { setAuthorityWindow(Number(event.target.value)); }} /></label><button disabled={role !== 'Compliance Lead'} onClick={reviseAuthority}>Revise correction authority policy</button><ol aria-label="Authority policy history">{state.authorityPolicies.filter((item) => item.obligationType === obligationType).map((item) => <li key={item.id}>{item.id} · {item.primaryAuthority ?? 'direct owner'} → {item.nextAuthority ?? 'none'} · {item.acknowledgementDays} day window · {item.effectiveOn}</li>)}</ol></section>
      {activeCorrection && <p aria-label="Pinned correction policy">Correction {activeCorrection.id} uses authority policy {activeCorrection.authorityPolicyId ?? 'legacy terms'} · primary {pinnedAuthorityPolicy?.primaryAuthority ?? 'direct owner'} · next {pinnedAuthorityPolicy?.nextAuthority ?? 'none'} · acknowledgement window {pinnedAuthorityPolicy?.acknowledgementDays ?? 'legacy'} day(s).</p>}
      <section aria-label="Assigned regulator corrections"><h3>Returned review obligations</h3><ol>{state.correctionRequests.map((item) => { const corrected = state.followUpDrafts.find((draftItem) => item.id === draftItem.correctionRequestId); const reviewerDecision = state.followUpReviews.find((reviewItem) => item.id === corrected?.correctionRequestId && reviewItem.draftId === corrected.id); const assignment = correctionAssignment(state, item.id); return <li key={item.id}>{item.obligationId} · owner {assignment?.owner ?? item.assignedOwner} · due {assignment?.dueOn ?? item.dueOn} · {assignment?.pendingOwner ? `handoff awaiting ${assignment.pendingOwner}` : reviewerDecision?.decision ?? (corrected ? "resubmitted for review" : "correction required")} · {item.requestedChanges}</li>; })}</ol>{activeCorrection && !state.followUpDrafts.some((item) => item.correctionRequestId === activeCorrection.id) && <><p>{correctionOwner?.overdue('2026-10-29') ? 'Correction overdue' : 'Correction due'} · owner {correctionOwner?.owner} · due {correctionOwner?.dueOn}</p><label>Designated higher authority<input value={higherAuthority} onChange={(event) => { setHigherAuthority(event.target.value); }} /></label><label>Replacement correction owner<input value={replacementOwner} onChange={(event) => { setReplacementOwner(event.target.value); }} /></label><label>Escalation reason<textarea value={escalationReason} onChange={(event) => { setEscalationReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(correctionOwner?.pendingScheduleId)} onClick={escalateCorrection}>Escalate overdue correction</button>{correctionOwner?.pendingOwner && <><p>Handoff to {correctionOwner.pendingOwner} awaits acknowledgement; original owner remains accountable.</p><p aria-label="Authority acceptance status">{pendingCorrectionSchedule?.higherAuthority ?? 'Authority not designated'} · acknowledgement due {pendingCorrectionSchedule?.acknowledgementDueOn ?? pendingCorrectionSchedule?.dueOn ?? 'unavailable'} · {pendingCorrectionSchedule && '2026-10-31' > (pendingCorrectionSchedule.acknowledgementDueOn ?? pendingCorrectionSchedule.dueOn) ? 'overdue, unresolved' : 'awaiting acceptance'} · current owner {correctionOwner.owner}</p><button disabled={role !== 'Compliance Lead'} onClick={followUpAuthority}>Record authority follow-up</button><label>Alternate higher authority<input value={alternateAuthority} onChange={(event) => { setAlternateAuthority(event.target.value); }} /></label><label>Reserve correction owner<input value={reserveOwner} onChange={(event) => { setReserveOwner(event.target.value); }} /></label><button disabled={role !== "Compliance Lead" || !pendingCorrectionSchedule || (pendingCorrectionSchedule.acknowledgementDueOn ?? pendingCorrectionSchedule.dueOn) >= "2026-11-01"} onClick={recoverUnacknowledged}>Reassign overdue unacknowledged handoff</button><button disabled={role !== (pendingCorrectionSchedule?.higherAuthority ? 'Compliance Lead' : 'Compliance Analyst')} onClick={acknowledgeEscalation}>Acknowledge correction handoff</button></>}</>}<ol aria-label="Correction schedule history">{state.correctionSchedule.filter((item) => selectedCorrectionIds.has(item.correctionRequestId)).map((item) => <li key={item.id}>{item.previousOwner} → {item.owner} · prior due {item.previousDueOn} · extended {item.dueOn} · {state.correctionAcknowledgements.some((ack) => ack.scheduleId === item.id) ? 'acknowledged' : state.legacyEffectiveScheduleIds.includes(item.id) ? 'legacy effective' : 'awaiting acknowledgement'} · authority {item.higherAuthority ?? item.owner} · ack due {item.acknowledgementDueOn ?? item.dueOn} · {item.evidenceReference}{item.replacesUnacknowledgedId ? ` · replaces unacknowledged ${item.replacesUnacknowledgedId}` : ""}</li>)}</ol><ol aria-label="Authority follow-up history">{state.authorityFollowUps.filter((item) => selectedCorrectionIds.has(item.correctionRequestId)).map((item) => <li key={item.id}>{item.authority} · {item.asOf} · {item.evidenceReference}</li>)}</ol></section>
      {draftComparison && followUpReadiness && <section aria-label="Regulatory follow-up review"><h3>Release review</h3><p>Original acknowledged release {draftComparison.current.sourceReleaseReference} · legal {followUpReadiness.sourceRelease?.legalApproval ?? 'unavailable'} · compliance {followUpReadiness.sourceRelease?.complianceApproval ?? 'unavailable'} · regulator acknowledgement {followUpReadiness.sourceRelease?.regulatorAcknowledgement ?? 'unavailable'}</p><p>Follow-up obligation {followUpReadiness.obligation?.obligationType ?? 'unavailable'} · requested {draftComparison.current.requestedInformation} · owner {draftComparison.current.owner} · due {followUpReadiness.obligation?.deadline ?? 'unavailable'}</p><p>Current draft evidence {draftComparison.current.evidenceReferences.join(', ')}</p><label>Review rationale<textarea value={reviewRationale} onChange={(event) => { setReviewRationale(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || state.followUpReviews.some((item) => item.draftId === draftComparison.current.id)} onClick={() => { reviewFollowUp('approved'); }}>Approve response draft</button><button disabled={role !== 'Compliance Lead' || state.followUpReviews.some((item) => item.draftId === draftComparison.current.id)} onClick={() => { reviewFollowUp('returned'); }}>Return response draft</button><p>Dispatch readiness: {followUpReadiness.dispatchStatus}</p><ol aria-label="Follow-up review history">{state.followUpReviews.filter((item) => item.obligationId === obligationId).map((item) => <li key={item.id}>{item.draftId} · {item.decision} · {item.rationale} · {item.reviewer}</li>)}</ol></section>}
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Response dispatch history">
        {state.dispatchAttempts.filter((item) => item.responseId === releaseCaseId).map((item) => (
          <li key={item.id}>
            {item.responseId} · {item.status} · attempt {item.attemptNumber} ·{" "}
            {item.dispatchEvidence ?? item.failureClassification}
          </li>
        ))}
      </ol>
      <ol aria-label="Follow-up release traceability">{state.followUpEvents.filter((item) => item.obligationId === obligationId && item.approvedDraftId).map((item) => <li key={item.id}>{item.stage} · draft {item.approvedDraftId} · independent review {item.approvedReviewId} · approval stage {item.approvalEventId ?? item.id} · evidence {item.evidenceReference}</li>)}</ol>      <ol aria-label="Regulator follow-up obligations">{followUps.map((item) => <li key={item.obligationId}>{item.obligationType} · {item.status} · owner {item.owner} · due {item.deadline} · {item.overdue ? "overdue" : "on track"}</li>)}</ol>
      <ol aria-label="Legal review schedule history">
        {state.reviewHistory.map((item) => (
          <li key={item.id}>
            {item.responseId} · {item.previousReviewer ?? "unassigned"} to{" "}
            {item.reviewer} · review {item.reviewOn} · deadline {item.deadline}
          </li>
        ))}
      </ol>
      <ol aria-label="Regulatory closure history">
        {state.closures.filter((item) => item.responseId === releaseCaseId).map((item) => (
          <li key={item.id}>
            {item.responseId} · release {item.releaseReference} · dispatch{" "}
            {item.dispatchEvidence} · acknowledgement{" "}
            {item.regulatorAcknowledgement}
          </li>
        ))}
      </ol>
    </section>
  );
}
