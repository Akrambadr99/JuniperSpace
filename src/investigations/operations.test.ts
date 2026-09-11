import { describe, expect, it } from 'vitest'
import { correlateAlerts, correlationClusters } from './correlation'
import { appendCustody, verifyCustody, type CustodyEvent } from './custody'
import { escalationDeadline, escalationStatus } from './escalation'
import { alerts, evidence, incidents } from './fixtures'

describe('security event correlation', () => {
  it('scores evidence and creates threshold-based clusters', () => {
    const edges = correlateAlerts(alerts, 10)
    expect(edges[0]).toMatchObject({ leftAlertId: 'AL-901', rightAlertId: 'AL-910', score: 65, reasons: ['shared asset', 'temporal proximity'] })
    expect(correlationClusters(alerts, edges, 60)).toEqual([['AL-901', 'AL-910'], ['AL-904']])
    expect(correlationClusters(alerts, edges, 90)).toHaveLength(3)
  })
})

describe('evidence custody and escalation', () => {
  const events: CustodyEvent[] = [{ evidenceId: 'EV-1', actor: 'Nora', at: '2027-03-15T08:25:00Z', action: 'collected', hash: '71aa' }, { evidenceId: 'EV-1', actor: 'Nora', at: '2027-03-15T08:40:00Z', action: 'sealed', hash: '71aa' }]
  it('requires collection, stable hash, ordering, and final seal', () => {
    expect(verifyCustody(evidence[0]!, events)).toEqual({ valid: true })
    expect(verifyCustody(evidence[0]!, [])).toEqual({ valid: false, issue: 'Custody chain must begin with collection.' })
    expect(verifyCustody(evidence[0]!, events.map((event) => ({ ...event, hash: 'changed' })))).toEqual({ valid: false, issue: 'Evidence hash changed during custody.' })
    expect(verifyCustody(evidence[0]!, events.slice(0, 1))).toEqual({ valid: false, issue: 'Evidence custody chain is not sealed.' })
    expect(() => appendCustody(events, { ...events[0]!, at: '2027-03-15T09:00:00Z', action: 'analyzed' })).toThrow(/Sealed/)
    expect(() => appendCustody(events.slice(0, 1), { ...events[0]!, at: '2027-03-15T08:20:00Z', action: 'analyzed' })).toThrow(/chronological/)
    expect(appendCustody(events.slice(0, 1), { ...events[0]!, at: '2027-03-15T08:30:00Z', action: 'analyzed' })).toHaveLength(2)
  })
  it('computes severity-specific response deadlines', () => {
    const policies = [{ severity: 'high' as const, acknowledgeMinutes: 30, commanderRequired: true }, { severity: 'critical' as const, acknowledgeMinutes: 10, commanderRequired: true }]
    const deadline = escalationDeadline(incidents[0]!, '2027-03-15T08:00:00Z', policies)
    expect(deadline).toBe('2027-03-15T08:30:00.000Z')
    expect(escalationStatus(deadline, undefined, '2027-03-15T08:20:00Z')).toBe('open')
    expect(escalationStatus(deadline, '2027-03-15T08:25:00Z', '2027-03-15T09:00:00Z')).toBe('met')
    expect(escalationStatus(deadline, '2027-03-15T08:40:00Z', '2027-03-15T09:00:00Z')).toBe('breached')
    expect(escalationStatus(deadline, undefined, '2027-03-15T09:00:00Z')).toBe('breached')
    expect(() => escalationDeadline({ ...incidents[0]!, severity: 'low' }, '2027-03-15T08:00:00Z', policies)).toThrow(/No escalation policy/)
  })
})
