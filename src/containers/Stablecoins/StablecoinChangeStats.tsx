import type { ReactNode } from 'react'
import { Change, formatChange } from '~/ui/Change'
import { MetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryChange } from '~/ui/SummaryStats'
import type { StablecoinChartSummary } from './chartSeries'

type StablecoinMcapChanges = Pick<
	StablecoinChartSummary,
	'change1d' | 'change7d' | 'change30d' | 'change1dUsd' | 'change7dUsd' | 'change30dUsd'
>

/** The market-cap headline with its 7d change, then the 1d and 30d changes as rows. A percent change implies both
    snapshots exist, so its dollar change is always there for the tooltip. */
export function StablecoinChangeStats({
	label,
	value,
	changes,
	labelAs = 'h1'
}: {
	label: ReactNode
	value: ReactNode
	changes: StablecoinMcapChanges | null
	labelAs?: 'span' | 'h1' | 'h2'
}) {
	return (
		<>
			<div className="flex flex-nowrap items-end justify-between gap-8">
				<StatItem label={label} labelAs={labelAs} value={value} truncate />
				{changes?.change7d != null ? (
					<SummaryChange
						value={changes.change7d}
						comparison="over 7d"
						tooltip={formatChange(changes.change7dUsd, 'usd')}
					/>
				) : null}
			</div>
			{changes?.change1d != null || changes?.change30d != null ? (
				<div className="flex flex-col">
					{changes.change1d != null ? (
						<MetricRow
							label="Change (1d)"
							value={<Change value={changes.change1d} tooltip={formatChange(changes.change1dUsd, 'usd')} />}
						/>
					) : null}
					{changes.change30d != null ? (
						<MetricRow
							label="Change (30d)"
							value={<Change value={changes.change30d} tooltip={formatChange(changes.change30dUsd, 'usd')} />}
						/>
					) : null}
				</div>
			) : null}
		</>
	)
}
