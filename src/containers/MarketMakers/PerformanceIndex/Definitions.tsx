import { Card } from '~/ui/Card'

const DEFINITIONS: { term: string; description: string }[] = [
	{
		term: 'Grade',
		description:
			'A simplified letter rating that reflects a market maker’s overall standing on the leaderboard. Grades are designed to make performance easier to interpret without relying solely on individual numerical scores.'
	},
	{
		term: 'Composite Score',
		description:
			'The weighted overall score used to rank market makers across the leaderboard. It reflects performance across trading KPIs, trust, coverage and capabilities, uptime, and integration level.'
	},
	{
		term: 'Trading KPIs',
		description:
			'Measures historical execution quality across 500+ tracked engagements. This includes liquidity depth, trading volume, spread performance, and adherence to agreed-upon trading obligations.'
	},
	{
		term: 'Trust',
		description:
			"Reflects Forgd's confidence in a market maker's observed performance. This is based on the number of tracked engagements and whether Forgd has identified potential trading abnormalities."
	},
	{
		term: 'Coverage & Capabilities',
		description:
			"Evaluates the breadth of a market maker's exchange coverage, ecosystem reach, and broader service offering. This includes centralized and decentralized exchange connectivity, as well as services beyond standard liquidity provision."
	},
	{
		term: 'Uptime',
		description:
			"Measures a market maker's consistency in meeting contractual obligations across tracked engagements. This typically includes maintaining required depth, spreads, and availability across supported venues."
	},
	{
		term: 'Integration Level',
		description:
			"Reflects the degree of connectivity between the market maker and Forgd's data systems. Higher integration levels provide greater visibility into tracked engagements, RFQ participation, and ongoing performance."
	}
]

export function Definitions() {
	return (
		<Card padding="md" className="flex flex-col gap-3">
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
