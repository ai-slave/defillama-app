import { resolveRef } from '../derive'
import type { ConditionNode, ProtocolRiskFixture } from '../types'

// Renders the AND/OR cause tree. AND = "ALL of", OR = "ANY of". Leaf `ref`s resolve via
// resolveRef into a link (external dependency) or an in-page anchor (oracle config).
function RefBadge({ refValue, protocol }: { refValue: string; protocol: ProtocolRiskFixture | null }) {
	const r = resolveRef(refValue, protocol)
	const base =
		'ml-1 inline-flex items-center rounded-sm bg-(--bg-main) px-1 py-0.5 font-mono text-[11px] text-(--text-secondary)'
	if (r.url) {
		return (
			<a
				href={r.url}
				target="_blank"
				rel="noreferrer"
				className={`${base} underline decoration-dotted hover:text-(--text-primary)`}
			>
				{r.label}
			</a>
		)
	}
	if (r.anchor) {
		return (
			<a href="#vault-risk-collateral" className={`${base} underline decoration-dotted hover:text-(--text-primary)`}>
				{r.label}
			</a>
		)
	}
	return <span className={base}>{r.label}</span>
}

function Node({ node, protocol }: { node: ConditionNode; protocol: ProtocolRiskFixture | null }) {
	if (node.op === 'leaf') {
		return (
			<li className="text-(--text-secondary)">
				{node.description}
				{node.ref ? <RefBadge refValue={node.ref} protocol={protocol} /> : null}
				{node.notes ? <span className="ml-1 text-(--text-secondary) italic">— {node.notes}</span> : null}
			</li>
		)
	}
	const connector = node.op === 'and' ? 'All of' : 'Any of'
	return (
		<li className="text-(--text-secondary)">
			<span className="text-xs font-semibold text-(--text-primary)">{connector}:</span>
			<ul className="mt-1 ml-4 list-disc space-y-1 marker:text-(--text-secondary)">
				{(node.children ?? []).map((child, i) => (
					<Node key={i} node={child} protocol={protocol} />
				))}
			</ul>
		</li>
	)
}

export function ConditionsTree({
	conditions,
	protocol
}: {
	conditions: ConditionNode
	protocol: ProtocolRiskFixture | null
}) {
	return (
		<ul className="list-disc space-y-1 pl-5 text-sm marker:text-(--text-secondary)">
			<Node node={conditions} protocol={protocol} />
		</ul>
	)
}
