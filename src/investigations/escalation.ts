import type { Incident, Severity } from './provenance';
export interface EscalationPolicy {
    severity: Severity;
    acknowledgeMinutes: number;
    commanderRequired: boolean;
}
export function escalationDeadline(incident: Incident, createdAt: string, policies: EscalationPolicy[]): string {
    const policy = policies.find((item) => item.severity === incident.severity);
    if (!policy)
        throw new Error(`No escalation policy exists for ${incident.severity} incidents.`);
    return new Date(new Date(createdAt).getTime() + policy.acknowledgeMinutes * 60000).toISOString();
}
export function escalationStatus(deadline: string, acknowledgedAt: string | undefined, now: string): 'open' | 'met' | 'breached' {
    if (acknowledgedAt)
        return acknowledgedAt <= deadline ? 'met' : 'breached';
    return now > deadline ? 'breached' : 'open';
}
