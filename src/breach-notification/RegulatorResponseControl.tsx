import { useRef, useState } from "react";
import { regulatorResponseReadiness } from "./regulator-readiness";
import {
  compareRegulatorFollowUpDrafts,
  getDispatchRecoveryStatus,
  getRegulatoryFollowUpReviewReadiness,
  getRegulatoryFollowUpObligations,
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
  const [draft, setDraft] = useState({ requested: "Provide current sealed device evidence", statement: "The corrected device evidence confirms the containment sequence.", evidence: "EVD-DEVICE-7", reason: "", owner: "Regulatory liaison" });
  const [reviewRationale, setReviewRationale] = useState("Evidence matches the acknowledged release and obligation request.");
  const feedback = useRef<HTMLParagraphElement>(null);
  const readiness = regulatorResponseReadiness(state.responses, "2026-10-20");
  const recovery = getDispatchRecoveryStatus(
    state,
    "REG-FCA-204",
    "RELEASE-204-R1",
  );
  const followUps = getRegulatoryFollowUpObligations(state, "2026-10-29");
  const draftComparison = compareRegulatorFollowUpDrafts(state, "OBL-204-A");
  const followUpReadiness = getRegulatoryFollowUpReviewReadiness(state, 'OBL-204-A');
  const prepareFollowUp = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: "OBL-204-A", requestedInformation: draft.requested, responseStatement: draft.statement, evidenceReferences: draft.evidence.split(",").map((item) => item.trim()).filter(Boolean), amendmentReason: draft.reason || null, owner: draft.owner, draftedBy: "Compliance analyst", draftedOn: "2026-10-26" })); setMessage("Obligation-specific response draft preserved for review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Follow-up drafting failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewFollowUp = (decision: 'approved' | 'returned') => { if (!draftComparison) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, obligationId: 'OBL-204-A', draftId: draftComparison.current.id, decision, rationale: reviewRationale, reviewer: 'Compliance lead', reviewedOn: '2026-10-26' })); setMessage(decision === 'approved' ? 'Latest response draft approved for obligation release.' : 'Response draft returned for correction; prior evidence remains preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow-up review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
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
      {draftComparison && <section aria-label="Follow-up amendment comparison"><h3>Follow-up response versions</h3><p>Source release {draftComparison.current.sourceReleaseReference} · previous {draftComparison.previous?.id ?? "none"} · current {draftComparison.current.id}</p><p>Statement {draftComparison.previous?.responseStatement ?? "original notification"} → {draftComparison.current.responseStatement}</p><p>Added evidence {draftComparison.addedEvidence.join(", ") || "none"} · removed evidence {draftComparison.removedEvidence.join(", ") || "none"} · reason {draftComparison.amendmentReason ?? "initial draft"}</p></section>}
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
