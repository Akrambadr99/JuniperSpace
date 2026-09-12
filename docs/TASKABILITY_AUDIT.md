# SentinelArc taskability audit

## Audit

Correlation combines filtered alert identities, incident selection, and partial eligibility. Evidence combines pending upload, digest/custody rules, navigation, and rollback. Playbooks combine required steps, roles, and containment. Escalation adds delegation, comments, and paginated audit. Fixed incidents, alerts, digests, actors, and clocks support 1–4-file tasks. Cosmetic severity work is weak; SIEM ingestion and storage replacement are too broad.

## 30 classified directions

**Strong candidate · Medium/Medium-Hard (19):** 1 filtered alert selection; 2 partial correlation plan; 3 stale alert eligibility; 4 incident-switch ownership; 5 removed-alert pruning; 6 evidence upload ownership; 7 digest failure mapping; 8 custody rollback; 9 playbook drafts per incident; 10 containment gate explanation; 11 permission change during response; 12 dated escalation delegation; 13 mention recipient edits; 14 comment tombstones; 15 history cursor recovery; 16 combined activity filters; 17 structured IOC search; 18 webhook terminal retry; 19 cross-tab refresh preserving selection.

**Medium (4):** 20 recurring review; 21 notification snooze; 22 import conflicts; 23 attachment duplicates.

**Poor hidden-test candidate (2):** 24 real threat-feed latency; 25 OS-dependent evidence picker.

**Too Easy (2):** 26 recolor severity; 27 rename Contained.

**Too Hard (3):** 28 replace evidence storage; 29 build SIEM ingestion; 30 orchestrate external response systems.

Strong count: **19**, driven by auditable security state and deterministic partial outcomes.

## Depth expansion directions 31–40

31. **Strong candidate · Medium-Hard:** containment combines required playbook, custody, and accountable owner. 32. **Strong candidate · Medium:** incident switching recomputes completed evidence. 33. **Strong candidate · Medium-Hard:** late evidence collection revokes readiness. 34. **Strong candidate · Medium:** optional failed steps remain distinct from required blockers. 35. **Strong candidate · Medium-Hard:** sealing final evidence updates containment without losing timeline selection. 36. **Strong candidate · Medium:** missing ownership has a stable visible reason. 37. **Strong candidate · Medium-Hard:** permission change preserves investigation state during approval. 38. **Strong candidate · Medium:** empty evidence cannot silently satisfy custody. 39. **Too Easy:** rename Governance blocked. 40. **Too Hard:** trigger external containment systems.

Expanded strong count: **27**.

## Strongest 15 candidates

Directions **1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 19, 31, 35, and 37** are the final shortlist. Their React judgment is respectively: filtered alert identity; partial correlation planning; refreshed eligibility; incident-scoped ownership; asynchronous evidence ownership; deterministic failure mapping; custody rollback; incident-keyed drafts; dependency-gate explanations; permission invalidation during response; time-bound escalation; cross-tab selection reconciliation; multi-entity containment derivation; immutable evidence affecting readiness; and permission changes that preserve investigation state.

## Evidence custody directions 41–50

41. **Strong candidate · Medium-Hard:** custody transfer combines evidence state, incident state, recipient, and digest acknowledgement. 42. **Strong candidate · Medium:** evidence navigation clears acknowledgement but preserves typed recipient. 43. **Strong candidate · Medium-Hard:** incident closure revokes a staged transfer. 44. **Strong candidate · Medium:** source custodian cannot receive the same evidence. 45. **Strong candidate · Medium-Hard:** digest changes require renewed acknowledgement. 46. **Strong candidate · Medium:** sealed evidence exposes a distinct immutable-state blocker. 47. **Strong candidate · Medium-Hard:** incident ownership prevents cross-case custody transfer. 48. **Strong candidate · Medium:** empty recipient and acknowledgement failures remain separate. 49. **Too Easy:** rename Custodian. 50. **Too Hard:** transfer custody to an external forensics platform.

Current strong count: **35**. Revised strongest 15: **1, 2, 3, 4, 6, 8, 9, 11, 12, 19, 31, 35, 37, 41, and 45**.
