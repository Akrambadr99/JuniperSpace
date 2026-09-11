import type { Alert } from './provenance'

export interface CorrelationEdge { leftAlertId: string; rightAlertId: string; score: number; reasons: string[] }
export function correlateAlerts(alerts: Alert[], windowMinutes: number): CorrelationEdge[] {
  const edges: CorrelationEdge[] = []
  for (const [first, left] of alerts.entries()) for (const right of alerts.slice(first + 1)) {
    let score = 0
    const reasons: string[] = []
    if (left.asset === right.asset) { score += 50; reasons.push('shared asset') }
    if (left.indicator === right.indicator) { score += 35; reasons.push('shared indicator') }
    const minutes = Math.abs(new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()) / 60_000
    if (minutes <= windowMinutes) { score += 15; reasons.push('temporal proximity') }
    if (score > 0) edges.push({ leftAlertId: left.id, rightAlertId: right.id, score, reasons })
  }
  return edges.sort((a, b) => b.score - a.score)
}

export function correlationClusters(alerts: Alert[], edges: CorrelationEdge[], threshold: number): string[][] {
  const groups = alerts.map((alert) => new Set([alert.id]))
  for (const edge of edges.filter((item) => item.score >= threshold)) {
    const left = groups.find((group) => group.has(edge.leftAlertId))
    const right = groups.find((group) => group.has(edge.rightAlertId))
    if (left && right && left !== right) { for (const id of right) left.add(id); groups.splice(groups.indexOf(right), 1) }
  }
  return groups.map((group) => [...group])
}
