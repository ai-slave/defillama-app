import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat'

export type StablecoinChangeStat = {
	days: 1 | 7 | 30
	percent: string | null
	absolute: string | null
}

type ValidChangeStat = StablecoinChangeStat & { percent: string; absolute: string }

function ChangeValue({ stat, prominent = false }: { stat: ValidChangeStat; prominent?: boolean }) {
	const color = stat.percent.startsWith('-') ? 'text-data-down' : 'text-data-up'

	if (prominent) {
		return (
			<span className="flex w-full flex-col">
				<span className="text-secondary">Change ({stat.days}d)</span>
				<span className="flex flex-nowrap items-end justify-between gap-1">
					<span className="mono-xl">{stat.absolute}</span>
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
			<Tooltip
				content={stat.absolute}
				render={<span className={`${color} min-w-0 truncate font-jetbrains underline decoration-dotted`} />}
			>
				{formatPercent(stat.percent, { input: 'percent' })}
			</Tooltip>
		</p>
	)
}

export function StablecoinChangeStats({ stats }: { stats: Array<StablecoinChangeStat> }) {
	const validStats = stats.filter((stat): stat is ValidChangeStat => stat.percent != null && stat.absolute != null)
	if (validStats.length === 0) return null

	const primary = validStats[0]
	if (!primary) return null
	const secondary = validStats.slice(1)
	if (secondary.length === 0) {
		return (
			<div className="body-lg">
				<ChangeValue stat={primary} prominent />
			</div>
		)
	}

	return (
		<details className="group body-lg">
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
