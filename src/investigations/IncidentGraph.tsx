import type { Alert, Incident } from './provenance';
const alertPositions: Record<string, [
    number,
    number
]> = { 'AL-901': [18, 25], 'AL-904': [18, 70], 'AL-910': [82, 30] };
const incidentPositions: Record<string, [
    number,
    number
]> = { 'INC-77': [48, 48], 'INC-81': [78, 72] };
export function IncidentGraph({ incidents, alerts }: {
    incidents: Incident[];
    alerts: Alert[];
}) {
    return <figure className="incident-graph"><figcaption><div><span>CORRELATION CANVAS</span><strong>Alert-to-incident provenance</strong></div><small>Edges retain source membership through merge and split operations.</small></figcaption><svg viewBox="0 0 100 100" role="img" aria-label="Security incident correlation graph">{alerts.flatMap((alert) => { const incidentId = alert.incidentId; const from = alertPositions[alert.id]; const to = incidentId ? incidentPositions[incidentId] : undefined; return from && to ? [<line key={alert.id} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}/>] : []; })}{alerts.map((alert, index) => { const position = alertPositions[alert.id] ?? [18, 20 + index * 20] as const; return <g key={alert.id} transform={`translate(${String(position[0])} ${String(position[1])})`} className="alert-node"><circle r="7"/><text textAnchor="middle" y="1">{alert.id.slice(3)}</text><title>{alert.source}: {alert.indicator}</title></g>; })}{incidents.map((incident, index) => { const position = incidentPositions[incident.id] ?? [60, 25 + index * 25] as const; return <g key={incident.id} transform={`translate(${String(position[0])} ${String(position[1])})`} className={`incident-node ${incident.severity}`}><rect x="-11" y="-8" width="22" height="16" rx="3"/><text textAnchor="middle" y="1">{incident.id}</text><title>{incident.title}</title></g>; })}</svg></figure>;
}
