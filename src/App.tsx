import { useMemo, useState } from 'react'
import { correlateAlerts } from './investigations/correlation'
import { EvidenceChainView } from './investigations/EvidenceChainView'
import { escalationDeadline, escalationStatus } from './investigations/escalation'
import { alerts, evidence, incidents, steps as initialSteps } from './investigations/fixtures'
import { IncidentGraph } from './investigations/IncidentGraph'
import { advanceContainment, mergeIncidents, type PlaybookStep, type SecurityRole } from './investigations/provenance'
import { PlaybookStepper } from './investigations/PlaybookStepper'

type Console = 'command' | 'correlation' | 'evidence' | 'playbook' | 'report'
const deadline = escalationDeadline(incidents[0]!, '2027-03-15T08:14:00Z', [{ severity: 'high', acknowledgeMinutes: 30, commanderRequired: true }])

function App() {
  const [consoleName, setConsoleName] = useState<Console>('command')
  const [role, setRole] = useState<SecurityRole>('Incident Commander')
  const [steps, setSteps] = useState<PlaybookStep[]>(initialSteps)
  const [message, setMessage] = useState('')
  const edges = useMemo(() => correlateAlerts(alerts, 10), [])

  function merge() { try { const merged = mergeIncidents(incidents[0]!, incidents[1]!, alerts, [6, 2], role); setMessage(`${merged.id} now correlates ${String(merged.alertIds.length)} alerts at ${merged.severity} severity; source provenance retained.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Incidents could not be merged.') } }
  function contain() { try { advanceContainment(incidents[0]!, steps, role); setMessage('Containment declared after all required playbook evidence completed.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Containment could not advance.') } }

  return <div className="soc-app"><header className="soc-header"><div className="soc-brand"><span>SA</span><div><strong>SentinelArc</strong><small>SECURITY OPERATIONS</small></div></div><div className="threat-state"><i />THREAT LEVEL <strong>ELEVATED</strong></div><label>Investigation role<select aria-label="Security role" value={role} onChange={(event) => { setRole(event.target.value as SecurityRole) }}><option>SOC Analyst</option><option>Incident Commander</option><option>Security Engineer</option><option>Auditor</option></select></label></header>
    <div className="soc-shell"><aside><span>INCIDENT CONSOLES</span>{(['command', 'correlation', 'evidence', 'playbook', 'report'] as Console[]).map((item) => <button key={item} aria-current={consoleName === item ? 'page' : undefined} onClick={() => { setConsoleName(item) }}>{item}</button>)}<div className="shift-owner"><span>ON CALL</span><strong>Nora El-Sayed</strong><small>SOC shift 08:00–16:00</small></div></aside><main>{message && <p className="soc-message" role="status">{message}</p>}
      {consoleName === 'command' && <><ConsoleHeading code="INC-77" title="Suspected credential compromise" detail="Investigation state, escalation clock, affected assets, and containment controls." badge="HIGH" /><div className="incident-kpis"><Kpi label="Linked alerts" value="2" /><Kpi label="Evidence objects" value="2" /><Kpi label="Affected identities" value="1" /><Kpi label="Escalation" value={escalationStatus(deadline, undefined, '2027-03-15T08:35:00Z')} /></div><div className="command-layout"><IncidentGraph incidents={incidents} alerts={alerts} /><section className="incident-timeline"><span>INVESTIGATION TIMELINE</span><Event time="08:14" title="EDR detection opened incident" detail="Encoded PowerShell on WS-441" /><Event time="08:17" title="Identity alert correlated" detail="Impossible travel for USR-29" /><Event time="08:25" title="Volatile log collected" detail="EV-1 · hash 71aa" /><Event time="08:31" title="Artifact derived" detail="EV-2 retains EV-1 parent provenance" /></section></div></>}
      {consoleName === 'correlation' && <><ConsoleHeading code="CORRELATION" title="Alert relationship graph" detail="Scores shared assets, indicators, and temporal proximity before suggesting merges." badge={`${String(edges.length)} EDGES`} /><IncidentGraph incidents={incidents} alerts={alerts} /><div className="correlation-actions"><div><strong>INC-77 + INC-81</strong><span>{edges[0]?.score ?? 0}% correlation confidence</span></div><button onClick={merge}>Merge investigations</button></div></>}
      {consoleName === 'evidence' && <><ConsoleHeading code="CHAIN OF CUSTODY" title="Evidence provenance" detail="Derived artifacts retain parent hashes and every originating alert." badge="3 OBJECTS" /><EvidenceChainView evidence={evidence} /></>}
      {consoleName === 'playbook' && <><ConsoleHeading code="IR-04" title="Credential compromise playbook" detail="Containment cannot advance while required response steps remain incomplete." badge="2 / 3" /><PlaybookStepper steps={steps} onComplete={(id) => { setSteps((current) => current.map((step) => step.id === id ? { ...step, state: 'complete' } : step)); setMessage('Playbook evidence marked complete.') }} /><button className="contain-button" onClick={contain}>Declare containment</button></>}
      {consoleName === 'report' && <><ConsoleHeading code="AUDITABLE OUTPUT" title="Incident report" detail="The report cites investigation events, evidence hashes, alert provenance, and decisions." badge="DRAFT" /><section className="report-sheet"><h2>Executive finding</h2><p>Credential compromise activity on WS-441 was correlated with impossible travel for USR-29. DNS evidence indicates likely command-and-control behavior requiring immediate containment.</p><h2>Affected scope</h2><p>One workstation, one identity, three alerts, and three preserved evidence objects.</p><h2>Outstanding action</h2><p>Revoke active identity sessions before the Incident Commander declares containment.</p></section></>}
    </main></div></div>
}

function ConsoleHeading({ code, title, detail, badge }: { code: string; title: string; detail: string; badge: string }) { return <div className="console-heading"><div><span>{code}</span><h1>{title}</h1><p>{detail}</p></div><b>{badge}</b></div> }
function Kpi({ label, value }: { label: string; value: string }) { return <article><span>{label}</span><strong>{value}</strong></article> }
function Event({ time, title, detail }: { time: string; title: string; detail: string }) { return <article><time>{time}</time><div><strong>{title}</strong><span>{detail}</span></div></article> }
export default App
