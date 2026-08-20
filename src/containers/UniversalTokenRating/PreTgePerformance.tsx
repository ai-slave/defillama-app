import { Panel } from '~/ui/Panel'
import { NoDataPlaceholder } from './TokenPage'

function NoDataCard({ title }: { title: string }) {
	return (
		<Panel padding="none">
			<div className="border-b border-subtle px-4 py-3">
				<h3 className="body-sm text-secondary">{title}</h3>
			</div>
			<div className="p-4">
				<NoDataPlaceholder />
			</div>
		</Panel>
	)
}

function ValueCard({ title, value }: { title: string; value: string }) {
	return (
		<Panel padding="none">
			<div className="border-b border-subtle px-4 py-3">
				<h3 className="body-sm text-secondary">{title}</h3>
			</div>
			<div className="flex min-h-[292px] items-center justify-center p-6 text-center">
				<span className="label-lg text-primary">{value}</span>
			</div>
		</Panel>
	)
}

export function PreTgePerformance({
	hasFundraising,
	lastRound
}: {
	hasFundraising: boolean | null
	lastRound: string | null
}) {
	const fundraisingStatus = lastRound ?? (hasFundraising ? 'Fundraising reported' : 'No fundraising reported')
	return (
		<>
			<h2 className="heading-sm">Performance Overview: Fundraising</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<NoDataCard title="Total Amount Fundraised (by Round)" />
				{hasFundraising == null ? (
					<NoDataCard title="Last Fundraising Round" />
				) : (
					<ValueCard title="Last Fundraising Round" value={fundraisingStatus} />
				)}
				<NoDataCard title="Quality of Investors (Tiers 1 - 3)" />
			</div>

			<h2 className="heading-sm">Performance Overview: Roadmap & Audibility</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<NoDataCard title="Past Roadmap Items Achieved On-time" />
				<NoDataCard title="Core software accessible by All" />
				<NoDataCard title="Smart Contract Audits Made Public" />
			</div>

			<h2 className="heading-sm">Performance Overview: Commercial Performance</h2>
			<NoDataCard title="Revenue Generated Relative to Peers" />

			<h2 className="heading-sm">Performance Overview: Community Engagement</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<NoDataCard title="Community Interest & Distribution" />
				<NoDataCard title="Historical Community Retention" />
			</div>
		</>
	)
}
