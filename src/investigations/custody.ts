import type { Evidence } from './provenance'

export interface CustodyEvent { evidenceId: string; actor: string; at: string; action: 'collected' | 'transferred' | 'analyzed' | 'sealed'; hash: string }
export function verifyCustody(evidence: Evidence, events: CustodyEvent[]): { valid: boolean; issue?: string } {
  const chain = events.filter((event) => event.evidenceId === evidence.id).sort((a, b) => a.at.localeCompare(b.at))
  if (chain[0]?.action !== 'collected') return { valid: false, issue: 'Custody chain must begin with collection.' }
  if (chain.some((event) => event.hash !== evidence.sha256)) return { valid: false, issue: 'Evidence hash changed during custody.' }
  if (chain.at(-1)?.action !== 'sealed') return { valid: false, issue: 'Evidence custody chain is not sealed.' }
  return { valid: true }
}

export function appendCustody(events: CustodyEvent[], next: CustodyEvent): CustodyEvent[] {
  const latest = events.filter((event) => event.evidenceId === next.evidenceId).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (latest?.action === 'sealed') throw new Error('Sealed evidence cannot receive another custody event.')
  if (latest && next.at <= latest.at) throw new Error('Custody events must preserve chronological order.')
  return [...events, next]
}
