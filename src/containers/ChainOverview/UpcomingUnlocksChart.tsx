import { useMemo } from 'react'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { domChartCrosshairStyles, domChartTooltipStyles } from '~/ui/ChartTooltip'
import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { getChainOverviewPaletteColor } from './constants'
import type { HomepageUnlockChartEntry } from './types'
import { useSmolChartHover } from './useSmolChartHover'

const BAR_COLOR = getChainOverviewPaletteColor(0)
const HOVERED_BAR_COLOR = getChainOverviewPaletteColor(1)

export function UpcomingUnlocksChart({
	data,
	className
}: {
	data: Array<HomepageUnlockChartEntry>
	className?: string
}) {
	const { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave } = useSmolChartHover(data.length)

	const maxVal = useMemo(() => Math.max(...data.map((d) => d.total)) || 1, [data])

	if (data.length === 0) return null
	const hoveredEntry = hoveredIndex == null ? undefined : data[hoveredIndex]

	return (
		<div className={className ?? 'my-auto h-[156px]'}>
			<div ref={containerRef} className="relative h-full" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
				<div className="flex h-full items-end">
					{data.map((d, i) => (
						<div key={d.date} className="flex h-full flex-1 items-end justify-center">
							<div
								className="w-[60%] min-w-[4px]"
								style={{
									height: `${(d.total / maxVal) * 100}%`,
									backgroundColor: hoveredIndex === i ? HOVERED_BAR_COLOR : BAR_COLOR
								}}
							/>
						</div>
					))}
				</div>
				{hoveredIndex != null && hoveredEntry ? (
					<div className={domChartCrosshairStyles} style={{ left: `${((hoveredIndex + 0.5) / data.length) * 100}%` }} />
				) : null}
				{hoveredEntry ? (
					<div ref={tooltipRef} className={domChartTooltipStyles}>
						<p>{formatTooltipChartDate(hoveredEntry.date, 'daily')}</p>
						<p style={{ fontWeight: 'bold', marginBottom: '4px' }}>
							Total: $
							{formatCompactNumber(hoveredEntry.total, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</p>
						{hoveredEntry.cliff !== null && hoveredEntry.linear !== null ? (
							<p style={{ marginBottom: '4px' }}>
								Cliff: $
								{formatCompactNumber(hoveredEntry.cliff, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
								&nbsp;&nbsp;Linear: $
								{formatCompactNumber(hoveredEntry.linear, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</p>
						) : null}
						{hoveredEntry.breakdown.map((item) => (
							<p key={item.token} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
								{item.token}&nbsp;&nbsp;$
								{formatCompactNumber(item.value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} (
								{formatPercent(item.pct, { input: 'percent' })})
							</p>
						))}
					</div>
				) : null}
			</div>
		</div>
	)
}
