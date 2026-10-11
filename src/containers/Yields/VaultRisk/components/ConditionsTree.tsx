import { Tag, TagLink } from '~/ui/Tag'
import { resolveRef } from '../derive'
import type { ConditionNode, ProtocolRiskFixture } from '../types'

// Renders the AND/OR cause tree. AND = "ALL of", OR = "ANY of". Leaf `ref`s resolve via
// resolveRef into a link (external dependency) or an in-page anchor (oracle config).
function RefBadge({ refValue, protocol }: { refValue: string; protocol: ProtocolRiskFixture | null }) {
	const r = resolveRef(refValue, protocol)
	if (r.url) {
		return (
			<TagLink href={r.url} target="_blank" rel="noreferrer" className="ml-1">
				{r.label}
			</TagLink>
		)
	}
	if (r.anchor) {
		return (
			<TagLink href="#vault-risk-collateral" className="ml-1">
				{r.label}
			</TagLink>
		)
	}
	return <Tag className="ml-1">{r.label}</Tag>
}

function Node({ node, protocol }: { node: ConditionNode; protocol: ProtocolRiskFixture | null }) {
	if (node.op === 'leaf') {
		return (
			<li className="text-secondary">
				{node.description}
				{node.ref ? <RefBadge refValue={node.ref} protocol={protocol} /> : null}
				{node.notes ? <span className="ml-1 text-secondary italic">— {node.notes}</span> : null}
			</li>
		)
	}
	const connector = node.op === 'and' ? 'All of' : 'Any of'
	return (
		<li className="text-secondary">
			<span className="label-sm text-primary">{connector}:</span>
			<ul className="mt-1 ml-4 list-disc space-y-1 marker:text-secondary">
				{(node.children ?? []).map((child, i) => (
					// oxlint-disable-next-line react/no-array-index-key -- Read-only condition branches have no IDs and may repeat refs or descriptions.
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
		<ul className="list-disc space-y-1 pl-5 body-md marker:text-secondary">
			<Node node={conditions} protocol={protocol} />
		</ul>
	)
}
