import { evidenceChain, type Evidence } from './provenance'

export function EvidenceChainView({ evidence }: { evidence: Evidence[] }) {
  return <div className="evidence-chains">{evidence.map((item) => { const chain = evidenceChain(evidence, item.id); return <article key={item.id}><div className="evidence-icon">{item.kind.slice(0, 1).toUpperCase()}</div><div><span>{item.kind} · {item.collectedAt}</span><h2>{item.id}</h2><code>sha256:{item.sha256}</code></div><div className="chain-path">{chain.map((node, index) => <span key={node.id}>{index > 0 && '→'} {node.id}</span>)}</div><b>{item.sourceAlertIds.join(', ')}</b></article> })}</div>
}
