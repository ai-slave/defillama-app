import { Card } from '~/ui/Card'

export function StatsCard({ label, value, subtle }: { label: string; value: string; subtle?: string }) {
	return (
		<Card as="dl" padding="sm" className="flex min-h-[86px] flex-col gap-1 transition-colors duration-200">
			<dt className="label-xs text-secondary uppercase">{label}</dt>
			<dd className="mono-lg text-primary">{value}</dd>
			{subtle ? <dd className="body-xs text-secondary">{subtle}</dd> : null}
		</Card>
	)
}
