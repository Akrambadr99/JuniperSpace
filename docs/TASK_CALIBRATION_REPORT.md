# SentinelArc task calibration report

SentinelArc's strongest surfaces combine incident correlation, evidence custody, response gates, and analyst ownership. The new correlation plan preserves selected alert identities through filtering and separates eligible from stale alerts.

| Workflow group | Why it is medium | React/state concepts | Hidden-test determinism | Likely future patch |
|---|---|---|---|---|
| Incident correlation | Filtered selection and alert lifecycle change independently | keyed selection, partial eligibility, derived state | High | 1–3 existing files |
| Evidence custody | Upload state, digest rules, and incident ownership interact | async state, rollback, immutable audit | High | 2–4 files |
| Playbook response | Required steps, roles, and containment gates combine | reducers, permissions, derived gates | High | 2–4 files |
| Escalation and audit | Delegation, comments, and history are time and actor scoped | fixed clock, lifecycle, pagination | High | 1–4 files |

## Calibration

- **Medium majority:** filtered alert selection; partial correlation plan; stale alert eligibility; incident-switch selection; evidence upload ownership; custody validation feedback; playbook drafts per incident; containment gate explanation; dated escalation delegation; analyst permission changes; comment mention edits; comment tombstones; cursor history paging; combined activity filters; structured IOC search; recurring review schedule; webhook retry status; notification snooze; import conflicts; cross-tab incident refresh preserving local selection.
- **Reject as Too Easy:** recolor severity; rename Contained; hide one button; add static helper copy.
- **Reject as Too Hard:** replace evidence storage; build a SIEM ingestion platform; migrate every incident; coordinate multiple external response systems.

The 20 Medium directions above are deterministic against fixed incidents, alerts, digests, actors, and clocks and should stay within 1–4 existing files.
