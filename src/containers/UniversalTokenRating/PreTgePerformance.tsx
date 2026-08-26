import { Panel } from '~/ui/Panel'

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
	if (hasFundraising == null && !lastRound) return null

	const fundraisingStatus = lastRound ?? (hasFundraising ? 'Fundraising reported' : 'No fundraising reported')
	return (
		<>
			<h2 className="heading-sm">Performance Overview: Fundraising</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<ValueCard title="Last Fundraising Round" value={fundraisingStatus} />
			</div>
		</>
	)
}
