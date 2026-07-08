import { Card } from '~/ui/Card'

const DEFINITIONS: { term: string; description: string }[] = [
	{
		term: 'Trading KPIs',
		description:
			'A data-driven score derived from historical trading activity across 500+ engagements, evaluating execution quality through metrics such as fill volume, depth provision, spread tightness, loan utilization, and market share.'
	},
	{
		term: 'Trust & Integration',
		description:
			"Measures the extent of a market maker's integration with Forgd and the reliability of its reported data, with higher scores reflecting broader engagement coverage, verified transparency, and consistent reporting integrity."
	},
	{
		term: 'Coverage & Capabilities',
		description:
			"Assesses the breadth of a market maker's operational reach and technical sophistication, including multi-chain support, exchange connectivity, and the ability to execute complex launch and liquidity strategies."
	},
	{
		term: 'Uptime',
		description:
			"Reflects a market maker's historical adherence to contractual KPIs, measuring the consistency with which quoted spread and depth obligations are met across tracked engagements."
	},
	{
		term: 'Integration Level',
		description:
			"Evaluates the extent of a market maker's operational integration with Forgd, with higher levels reflecting the ability to both participate in RFQs and provide historical and real-time engagement data."
	},
	{
		term: 'Composite Score',
		description:
			'An overall performance rating calculated as a weighted aggregation of Trading KPIs, Trust & Integration, Coverage & Capabilities, and Uptime, with greater emphasis placed on demonstrated trading performance.'
	}
]

export function Definitions() {
	return (
		<Card border="subtle" className="flex flex-col gap-3">
			<h2 className="heading-xs">Definitions</h2>
			<div className="flex flex-col text-sm">
				{DEFINITIONS.map((def) => (
					<div
						key={def.term}
						className="flex flex-col gap-1 border-b border-subtle py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
					>
						<span className="font-medium sm:w-[220px] sm:shrink-0">{def.term}</span>
						<span className="text-secondary">{def.description}</span>
					</div>
				))}
			</div>
		</Card>
	)
}
