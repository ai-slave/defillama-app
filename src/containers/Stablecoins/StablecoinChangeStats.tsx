import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat'

export type StablecoinChangeStat = {
	days: 1 | 7 | 30
	percent: string | null
	absolute: string | null
}

function ChangeValue({ stat, prominent = false }: { stat: StablecoinChangeStat; prominent?: boolean }) {
	if (stat.percent == null || stat.absolute == null) return null
	const color = stat.percent.startsWith('-') ? 'text-data-down' : 'text-data-up'

	if (prominent) {
		return (
			<span className="flex w-full flex-col">
				<span className="text-secondary">Change ({stat.days}d)</span>
				<span className="flex flex-nowrap items-end justify-between gap-1">
					<span className="font-jetbrains text-2xl font-semibold">{stat.absolute}</span>
					<span className={`${color} truncate font-jetbrains`}>
						{formatPercent(stat.percent, { input: 'percent' })}
					</span>
				</span>
			</span>
		)
	}

	return (
		<p className="mt-3 flex flex-wrap items-center justify-between gap-2">
			<span className="text-secondary">Change ({stat.days}d)</span>
			<Tooltip content={stat.absolute} className={`${color} truncate font-jetbrains underline decoration-dotted`}>
				{formatPercent(stat.percent, { input: 'percent' })}
			</Tooltip>
		</p>
	)
}

export function StablecoinChangeStats({ stats }: { stats: StablecoinChangeStat[] }) {
	const validStats = stats.filter(
		(stat): stat is StablecoinChangeStat & { percent: string; absolute: string } =>
			stat.percent != null && stat.absolute != null
	)
	if (validStats.length === 0) return null

	const [primary, ...secondary] = validStats
	if (secondary.length === 0) {
		return (
			<div className="text-base">
				<ChangeValue stat={primary} prominent />
			</div>
		)
	}

	return (
		<details className="group text-base">
			<summary className="flex items-center">
				<Icon
					name="chevron-right"
					height={20}
					width={20}
					className="-mb-5 -ml-5 text-tertiary transition-transform duration-100 group-open:rotate-90"
				/>
				<ChangeValue stat={primary} prominent />
			</summary>
			{secondary.map((stat) => (
				<ChangeValue key={stat.days} stat={stat} />
			))}
		</details>
	)
}
