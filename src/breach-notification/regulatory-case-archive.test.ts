import { expect, it } from 'vitest'
import { BrowserRegulatorResponsePersistence, captureRegulatoryCaseArchive, initialRegulatorResponseState, regulatoryCaseIntegrity } from './regulator-response-domain'

const command = { id: 'case-archive-1', expectedRevision: 0, responseId: 'REG-FCA-204', role: 'Compliance Lead' as const, createdBy: 'compliance lead', createdOn: '2026-10-29' }

it('pins a regulatory case and keeps later case changes outside its archive', () => {
  const archived = captureRegulatoryCaseArchive(initialRegulatorResponseState, command)
  expect(archived.caseArchives[0]).toMatchObject({ schemaVersion: 1, responseId: command.responseId, sourceRevision: 0, immutable: true })
  expect(captureRegulatoryCaseArchive(archived, command)).toBe(archived)
  const changed = structuredClone(archived)
  changed.responses[0]!.released = true
  expect(changed.caseArchives[0]?.response.released).toBe(false)
  expect(() => captureRegulatoryCaseArchive(archived, { ...command, id: 'case-archive-2' })).toThrow('changed')
  expect(() => captureRegulatoryCaseArchive(initialRegulatorResponseState, { ...command, role: 'Compliance Analyst' })).toThrow('compliance lead')
})

it('blocks broken dispatch and acknowledgement lineage without writing, and loads legacy state', () => {
  const broken = structuredClone(initialRegulatorResponseState)
  broken.closures.push({ id: 'closure-1', responseId: command.responseId, reviewChangeId: 'missing-review', evidenceIds: [], legalApproval: 'legal', complianceApproval: 'compliance', releaseReference: 'RELEASE-1', dispatchEvidence: 'DISPATCH-1', regulatorAcknowledgement: 'ACK-1', outstandingFollowUps: 0, closedBy: 'lead', closedOn: '2026-10-29', immutable: true })
  expect(regulatoryCaseIntegrity(broken, command.responseId)).toContain('Acknowledged release lacks its legal review or successful dispatch source.')
  expect(() => captureRegulatoryCaseArchive(broken, command)).toThrow('Acknowledged release')
  expect(broken.caseArchives).toEqual([])
  const old = structuredClone(initialRegulatorResponseState) as unknown as Record<string, unknown>
  delete old['caseArchives']
  expect(new BrowserRegulatorResponsePersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()?.caseArchives).toEqual([])
})
