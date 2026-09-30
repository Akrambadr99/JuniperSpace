import { useRef, useState } from "react";
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
} from "./regulator-response-domain";

export function RegulatorResponseControl() {
  const [repository] = useState(
    () => new RegulatorResponseRepository(localStorage),
  );
  const [state, setState] = useState(() => repository.read());
  const [role, setRole] = useState<RegulatorControlRole>("Compliance Analyst");
  const [message, setMessage] = useState("");
  const [archiveCaseId, setArchiveCaseId] = useState('REG-FCA-204');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ requested: "Provide current sealed device evidence", statement: "The corrected device evidence confirms the containment sequence.", evidence: "EVD-DEVICE-7", reason: "", owner: "Regulatory liaison" });
  const [reviewRationale, setReviewRationale] = useState("Evidence matches the acknowledged release and obligation request.");
  const [replacementOwner, setReplacementOwner] = useState("Senior regulatory liaison");
  const [reserveOwner, setReserveOwner] = useState("Regulatory duty manager");
  const [higherAuthority, setHigherAuthority] = useState('Senior compliance lead');
  const [alternateAuthority, setAlternateAuthority] = useState('Duty compliance lead');
  const [authorityWindow, setAuthorityWindow] = useState(1);
  const [escalationReason, setEscalationReason] = useState("Original correction deadline passed without the required custody evidence.");
  const feedback = useRef<HTMLParagraphElement>(null);
  const readiness = regulatorResponseReadiness(state.responses, "2026-10-20");
  const archiveIssues = regulatoryCaseIntegrity(state, archiveCaseId);
  const selectedArchive = state.caseArchives.find((item) => item.id === selectedArchiveId) ?? state.caseArchives.at(-1);
  const captureArchive = () => { try { const id = crypto.randomUUID(); setState(repository.captureArchive({ id, expectedRevision: state.revision, responseId: archiveCaseId, role, createdBy: 'Compliance lead', createdOn: '2026-10-29' })); setSelectedArchiveId(id); setMessage('Regulatory case archive captured with verified release and correction lineage.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Case archive failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recovery = getDispatchRecoveryStatus(
    state,
    "REG-FCA-204",
    "RELEASE-204-R1",
  );
  const followUps = getRegulatoryFollowUpObligations(state, "2026-10-29");
  const draftComparison = compareRegulatorFollowUpDrafts(state, "OBL-204-A");
  const followUpReadiness = getRegulatoryFollowUpReviewReadiness(state, 'OBL-204-A');
  const prepareFollowUp = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: "OBL-204-A", requestedInformation: draft.requested, responseStatement: draft.statement, evidenceReferences: draft.evidence.split(",").map((item) => item.trim()).filter(Boolean), amendmentReason: draft.reason || null, owner: draft.owner, draftedBy: "Compliance analyst", draftedOn: state.correctionSchedule.length > 0 ? "2026-10-30" : "2026-10-26" })); setMessage("Obligation-specific response draft preserved for review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Follow-up drafting failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewFollowUp = (decision: 'approved' | 'returned') => { if (!draftComparison) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: 'OBL-204-A', draftId: draftComparison.current.id, decision, rationale: reviewRationale, reviewer: 'Compliance lead', reviewedOn: '2026-10-26' })); setMessage(decision === 'approved' ? 'Latest response draft approved for obligation release.' : 'Response draft returned for correction; prior evidence remains preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow-up review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const activeCorrection = state.correctionRequests.filter((item) => item.obligationId === 'OBL-204-A').at(-1);
  const currentAuthorityPolicy = state.authorityPolicies.filter((item) => item.obligationType === 'evidence-supplement').at(-1);
  const pinnedAuthorityPolicy = state.authorityPolicies.find((item) => item.id === activeCorrection?.authorityPolicyId);
  const correctionOwner = activeCorrection ? correctionAssignment(state, activeCorrection.id) : null;
  const pendingCorrectionSchedule = state.correctionSchedule.find((item) => item.id === correctionOwner?.pendingScheduleId);
  const reviseAuthority = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationType: 'evidence-supplement', effectiveOn: '2026-10-25', primaryAuthority: higherAuthority, nextAuthority: alternateAuthority, acknowledgementDays: authorityWindow, approvedBy: 'Compliance lead' })); setMessage('Correction authority policy revised for future returned reviews.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Authority policy revision failed.'); } queueMicrotask(() => feedback.current?.focus()); };
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
          responseId: "REG-FCA-204",
          reviewer: "Senior privacy counsel",
          reviewOn: "2026-10-20T18:00:00Z",
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
          responseId: "REG-FCA-204",
          releaseReference: "RELEASE-204-R1",
          releaseRevision: state.revision,
          status: "succeeded",
          failureClassification: null,
          retryEligible: false,
          actor: "Compliance dispatch service",
          attemptedOn: "2026-10-20T19:30:00Z",
          retryOf: null,
          dispatchEvidence: "DISPATCH-FCA-204",
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
          responseId: "REG-FCA-204",
          releaseReference: "RELEASE-204-R1",
          releaseRevision: state.revision,
          status: "failed",
          failureClassification: "regulator-gateway-timeout",
          retryEligible: true,
          actor: "Compliance dispatch service",
          attemptedOn: "2026-10-20T19:25:00Z",
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
          responseId: "REG-FCA-204",
          releaseReference: failed.releaseReference,
          releaseRevision: failed.releaseRevision,
          status: "succeeded",
          failureClassification: null,
          retryEligible: false,
          actor: "Compliance dispatch service",
          attemptedOn: "2026-10-20T19:35:00Z",
          retryOf: failed.id,
          dispatchEvidence: "DISPATCH-FCA-204",
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
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          responseId: "REG-FCA-204",
          evidenceIds: ["EVD-DEVICE-7"],
          legalApproval: "LEGAL-APP-204",
          complianceApproval: "COMP-APP-204",
          releaseReference: "RELEASE-204-R1",
          dispatchEvidence: "DISPATCH-FCA-204",
          regulatorAcknowledgement: "ACK-FCA-204",
          outstandingFollowUps: 0,
          closedBy: "Compliance lead",
          closedOn: "2026-10-20T20:00:00Z",
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
  const advanceFollowUp = () => { const stages: RegulatoryFollowUpStage[] = ["opened", "drafted", "approved", "dispatched", "acknowledged", "closed"]; const history = state.followUpEvents.filter((item) => item.obligationId === "OBL-204-A"); const stage = stages[history.length]; if (!stage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: "OBL-204-A", responseId: "REG-FCA-204", releaseReference: "RELEASE-204-R1", obligationType: "evidence-supplement", deadline: "2026-10-28", owner: "Regulatory liaison", stage, evidenceReference: stage === "approved" && draftComparison ? draftComparison.current.id : `FOLLOWUP-${stage}`, actor: "Compliance lead", occurredOn: "2026-10-26" })); setMessage(`Regulator follow-up ${stage}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Follow-up update failed."); } queueMicrotask(() => feedback.current?.focus()); };
  return (
    <section className="card" aria-label="Regulator response readiness">
      <h2>Regulator response readiness</h2>
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
      <section aria-label="Regulatory case evidence archive"><h3>Case evidence archive</h3><label>Regulatory case<select value={archiveCaseId} onChange={(event) => { setArchiveCaseId(event.target.value); }}>{state.responses.map((item) => <option key={item.responseId} value={item.responseId}>{item.responseId}</option>)}</select></label><p aria-label="Regulatory archive integrity">{archiveIssues.length ? archiveIssues.join(' ') : 'Release, dispatch, follow-up, and correction lineage verified.'}</p><button disabled={role !== 'Compliance Lead' || archiveIssues.length > 0} onClick={captureArchive}>Capture regulatory case archive</button><ol aria-label="Regulatory case archive history">{state.caseArchives.map((item) => <li key={item.id}><button aria-pressed={selectedArchive?.id === item.id} onClick={() => { setSelectedArchiveId(item.id); }}>{item.responseId} · {item.createdOn} · revision {item.sourceRevision}</button></li>)}</ol>{selectedArchive && <div aria-label="Selected regulatory case archive"><p>Archive {selectedArchive.id} · schema {selectedArchive.schemaVersion} · case {selectedArchive.responseId} · source revision {selectedArchive.sourceRevision}</p><p>{selectedArchive.closures.length} acknowledged releases · {selectedArchive.dispatchAttempts.length} dispatch attempts · {selectedArchive.followUpEvents.length} follow-up events · {selectedArchive.correctionRequests.length} correction requests</p><p>{selectedArchive.authorityPolicies ? `${String(selectedArchive.authorityPolicies.length)} pinned authority policy revisions · ${String(selectedArchive.legacyEffectiveScheduleIds?.length ?? 0)} legacy effective schedules` : 'Authority policy evidence was not included in this legacy archive.'}</p><a download={`regulatory-case-${selectedArchive.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedArchive, null, 2))}`}>Download selected case archive</a></div>}</section>
      <button
        disabled={role !== "Compliance Lead" || state.reviewHistory.length > 0}
        onClick={reschedule}
      >
        Reassign urgent legal review
      </button>
      <button
        disabled={
          role !== "Compliance Lead" ||
          state.reviewHistory.length === 0 ||
          state.dispatchAttempts.length > 0
        }
        onClick={dispatch}
      >
        Dispatch approved response
      </button>
      <button
        disabled={
          role !== "Compliance Lead" ||
          state.reviewHistory.length === 0 ||
          state.dispatchAttempts.length > 0
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
          !state.dispatchAttempts.some((item) => item.status === "succeeded") ||
          state.closures.length > 0
        }
        onClick={close}
      >
        Acknowledge and close response
      </button>
      <button disabled={role !== "Compliance Lead" || state.closures.length === 0 || state.followUpEvents.filter((item) => item.obligationId === "OBL-204-A").length >= 6} onClick={advanceFollowUp}>Advance regulator follow-up</button>
      <fieldset><legend>Obligation response draft</legend><label>Requested regulator information<input value={draft.requested} onChange={(event) => { setDraft({ ...draft, requested: event.target.value }); }} /></label><label>Response statement<textarea value={draft.statement} onChange={(event) => { setDraft({ ...draft, statement: event.target.value }); }} /></label><label>Evidence references<input value={draft.evidence} onChange={(event) => { setDraft({ ...draft, evidence: event.target.value }); }} /></label><label>Amendment reason<input value={draft.reason} onChange={(event) => { setDraft({ ...draft, reason: event.target.value }); }} /></label><label>Response owner<input value={draft.owner} onChange={(event) => { setDraft({ ...draft, owner: event.target.value }); }} /></label><button disabled={followUps.length === 0 || followUps[0]?.status === "closed"} onClick={prepareFollowUp}>Save obligation draft</button></fieldset>
      {draftComparison && <section aria-label="Follow-up amendment comparison"><h3>Follow-up response versions</h3><p>Source release {draftComparison.current.sourceReleaseReference} · previous {draftComparison.previous?.id ?? "none"} · current {draftComparison.current.id} · correction {draftComparison.current.correctionRequestId ?? "none"}</p><p>Statement {draftComparison.previous?.responseStatement ?? "original notification"} → {draftComparison.current.responseStatement}</p><p>Added evidence {draftComparison.addedEvidence.join(", ") || "none"} · removed evidence {draftComparison.removedEvidence.join(", ") || "none"} · reason {draftComparison.amendmentReason ?? "initial draft"}</p></section>}
      <section aria-label="Correction authority policy"><h3>Correction authority schedule</h3><p>Current evidence-supplement policy {currentAuthorityPolicy?.id ?? 'unavailable'} · effective {currentAuthorityPolicy?.effectiveOn ?? 'unavailable'}</p><label>Policy primary authority<input value={higherAuthority} onChange={(event) => { setHigherAuthority(event.target.value); }} /></label><label>Policy next authority<input value={alternateAuthority} onChange={(event) => { setAlternateAuthority(event.target.value); }} /></label><label>Authority acknowledgement days<input type="number" min="1" max="14" value={authorityWindow} onChange={(event) => { setAuthorityWindow(Number(event.target.value)); }} /></label><button disabled={role !== 'Compliance Lead'} onClick={reviseAuthority}>Revise correction authority policy</button><ol aria-label="Authority policy history">{state.authorityPolicies.filter((item) => item.obligationType === 'evidence-supplement').map((item) => <li key={item.id}>{item.id} · {item.primaryAuthority ?? 'direct owner'} → {item.nextAuthority ?? 'none'} · {item.acknowledgementDays} day window · {item.effectiveOn}</li>)}</ol></section>
      {activeCorrection && <p aria-label="Pinned correction policy">Correction {activeCorrection.id} uses authority policy {activeCorrection.authorityPolicyId ?? 'legacy terms'} · primary {pinnedAuthorityPolicy?.primaryAuthority ?? 'direct owner'} · next {pinnedAuthorityPolicy?.nextAuthority ?? 'none'} · acknowledgement window {pinnedAuthorityPolicy?.acknowledgementDays ?? 'legacy'} day(s).</p>}
      <section aria-label="Assigned regulator corrections"><h3>Returned review obligations</h3><ol>{state.correctionRequests.map((item) => { const corrected = state.followUpDrafts.find((draftItem) => item.id === draftItem.correctionRequestId); const reviewerDecision = state.followUpReviews.find((reviewItem) => item.id === corrected?.correctionRequestId && reviewItem.draftId === corrected.id); const assignment = correctionAssignment(state, item.id); return <li key={item.id}>{item.obligationId} · owner {assignment?.owner ?? item.assignedOwner} · due {assignment?.dueOn ?? item.dueOn} · {assignment?.pendingOwner ? `handoff awaiting ${assignment.pendingOwner}` : reviewerDecision?.decision ?? (corrected ? "resubmitted for review" : "correction required")} · {item.requestedChanges}</li>; })}</ol>{activeCorrection && !state.followUpDrafts.some((item) => item.correctionRequestId === activeCorrection.id) && <><p>{correctionOwner?.overdue('2026-10-29') ? 'Correction overdue' : 'Correction due'} · owner {correctionOwner?.owner} · due {correctionOwner?.dueOn}</p><label>Designated higher authority<input value={higherAuthority} onChange={(event) => { setHigherAuthority(event.target.value); }} /></label><label>Replacement correction owner<input value={replacementOwner} onChange={(event) => { setReplacementOwner(event.target.value); }} /></label><label>Escalation reason<textarea value={escalationReason} onChange={(event) => { setEscalationReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(correctionOwner?.pendingScheduleId)} onClick={escalateCorrection}>Escalate overdue correction</button>{correctionOwner?.pendingOwner && <><p>Handoff to {correctionOwner.pendingOwner} awaits acknowledgement; original owner remains accountable.</p><p aria-label="Authority acceptance status">{pendingCorrectionSchedule?.higherAuthority ?? 'Authority not designated'} · acknowledgement due {pendingCorrectionSchedule?.acknowledgementDueOn ?? pendingCorrectionSchedule?.dueOn ?? 'unavailable'} · {pendingCorrectionSchedule && '2026-10-31' > (pendingCorrectionSchedule.acknowledgementDueOn ?? pendingCorrectionSchedule.dueOn) ? 'overdue, unresolved' : 'awaiting acceptance'} · current owner {correctionOwner.owner}</p><button disabled={role !== 'Compliance Lead'} onClick={followUpAuthority}>Record authority follow-up</button><label>Alternate higher authority<input value={alternateAuthority} onChange={(event) => { setAlternateAuthority(event.target.value); }} /></label><label>Reserve correction owner<input value={reserveOwner} onChange={(event) => { setReserveOwner(event.target.value); }} /></label><button disabled={role !== "Compliance Lead" || !pendingCorrectionSchedule || (pendingCorrectionSchedule.acknowledgementDueOn ?? pendingCorrectionSchedule.dueOn) >= "2026-11-01"} onClick={recoverUnacknowledged}>Reassign overdue unacknowledged handoff</button><button disabled={role !== (pendingCorrectionSchedule?.higherAuthority ? 'Compliance Lead' : 'Compliance Analyst')} onClick={acknowledgeEscalation}>Acknowledge correction handoff</button></>}</>}<ol aria-label="Correction schedule history">{state.correctionSchedule.map((item) => <li key={item.id}>{item.previousOwner} → {item.owner} · prior due {item.previousDueOn} · extended {item.dueOn} · {state.correctionAcknowledgements.some((ack) => ack.scheduleId === item.id) ? 'acknowledged' : state.legacyEffectiveScheduleIds.includes(item.id) ? 'legacy effective' : 'awaiting acknowledgement'} · authority {item.higherAuthority ?? item.owner} · ack due {item.acknowledgementDueOn ?? item.dueOn} · {item.evidenceReference}{item.replacesUnacknowledgedId ? ` · replaces unacknowledged ${item.replacesUnacknowledgedId}` : ""}</li>)}</ol><ol aria-label="Authority follow-up history">{state.authorityFollowUps.map((item) => <li key={item.id}>{item.authority} · {item.asOf} · {item.evidenceReference}</li>)}</ol></section>
      {draftComparison && followUpReadiness && <section aria-label="Regulatory follow-up review"><h3>Release review</h3><p>Original acknowledged release {draftComparison.current.sourceReleaseReference} · legal {followUpReadiness.sourceRelease?.legalApproval ?? 'unavailable'} · compliance {followUpReadiness.sourceRelease?.complianceApproval ?? 'unavailable'} · regulator acknowledgement {followUpReadiness.sourceRelease?.regulatorAcknowledgement ?? 'unavailable'}</p><p>Follow-up obligation {followUpReadiness.obligation?.obligationType ?? 'unavailable'} · requested {draftComparison.current.requestedInformation} · owner {draftComparison.current.owner} · due {followUpReadiness.obligation?.deadline ?? 'unavailable'}</p><p>Current draft evidence {draftComparison.current.evidenceReferences.join(', ')}</p><label>Review rationale<textarea value={reviewRationale} onChange={(event) => { setReviewRationale(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || state.followUpReviews.some((item) => item.draftId === draftComparison.current.id)} onClick={() => { reviewFollowUp('approved'); }}>Approve response draft</button><button disabled={role !== 'Compliance Lead' || state.followUpReviews.some((item) => item.draftId === draftComparison.current.id)} onClick={() => { reviewFollowUp('returned'); }}>Return response draft</button><p>Dispatch readiness: {followUpReadiness.dispatchStatus}</p><ol aria-label="Follow-up review history">{state.followUpReviews.map((item) => <li key={item.id}>{item.draftId} · {item.decision} · {item.rationale} · {item.reviewer}</li>)}</ol></section>}
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Response dispatch history">
        {state.dispatchAttempts.map((item) => (
          <li key={item.id}>
            {item.responseId} · {item.status} · attempt {item.attemptNumber} ·{" "}
            {item.dispatchEvidence ?? item.failureClassification}
          </li>
        ))}
      </ol>
      <ol aria-label="Regulator follow-up obligations">{followUps.map((item) => <li key={item.obligationId}>{item.obligationType} · {item.status} · owner {item.owner} · due {item.deadline} · {item.overdue ? "overdue" : "on track"}</li>)}</ol>
      <ol aria-label="Legal review schedule history">
        {state.reviewHistory.map((item) => (
          <li key={item.id}>
            {item.responseId} · {item.previousReviewer ?? "unassigned"} to{" "}
            {item.reviewer} · review {item.reviewOn} · deadline {item.deadline}
          </li>
        ))}
      </ol>
      <ol aria-label="Regulatory closure history">
        {state.closures.map((item) => (
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
