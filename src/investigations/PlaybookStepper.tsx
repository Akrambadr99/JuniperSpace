import type { PlaybookStep } from './provenance'

export function PlaybookStepper({ steps, onComplete }: { steps: PlaybookStep[]; onComplete: (id: string) => void }) {
  return <ol className="playbook-stepper">{steps.map((step, index) => <li key={step.id} className={step.state}><div>{step.state === 'complete' ? '✓' : String(index + 1)}</div><section><span>{step.required ? 'REQUIRED RESPONSE' : 'OPTIONAL'}</span><h2>{step.label}</h2><p>Execution state: {step.state}</p></section>{step.state !== 'complete' && <button onClick={() => { onComplete(step.id) }}>Mark complete</button>}</li>)}</ol>
}
