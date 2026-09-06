import { Card } from '~/ui/Card'

export function StatsCard({
	label,
	value,
	subtle,
	variant = 'default'
}: {
	label: string
	value: string
	subtle?: string
	variant?: 'default' | 'highlight'
}) {
	const valueClass =
		variant === 'highlight'
			? 'font-jetbrains text-2xl font-semibold text-primary'
			: 'font-jetbrains text-xl font-semibold text-primary'

	return (
		<Card as="dl" padding="sm" className="flex min-h-[86px] flex-col gap-1 transition-colors duration-200">
			<dt className="label-xs text-secondary uppercase">{label}</dt>
			<dd className={valueClass}>{value}</dd>
			{subtle ? <dd className="body-xs text-secondary">{subtle}</dd> : null}
		</Card>
	)
}
