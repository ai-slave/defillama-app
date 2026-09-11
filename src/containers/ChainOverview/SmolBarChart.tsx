import { useMemo } from 'react'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { purple } from '~/constants/colors'
import { domChartCrosshairStyles, domChartTooltipStyles } from '~/ui/ChartTooltip'
import { formatUsd } from '~/utils/numberFormat'
import { getChainOverviewPaletteColor } from './constants'
import { useSmolChartHover } from './useSmolChartHover'

const POSITIVE_BAR_COLOR = getChainOverviewPaletteColor(0)

export function SmolBarChart({
	series,
	className,
	groupBy
}: {
	series: Array<[number, number]>
	className?: string
	groupBy?: 'daily' | 'weekly' | 'monthly'
}) {
	const { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave } = useSmolChartHover(series.length)

	const { bars, hasNegative, posRatio } = useMemo(() => {
		if (series.length === 0) return { bars: [], hasNegative: false, posRatio: 1 }

		const values = series.map((s) => s[1])
		const maxPos = Math.max(0, ...values) || 1
		const maxNeg = Math.max(0, ...values.map((v) => -Math.min(0, v)))
		const neg = maxNeg > 0

		return {
			bars: series.map(([timestamp, v]) => ({
				timestamp,
				heightPct: v >= 0 ? (v / maxPos) * 100 : (Math.abs(v) / (maxNeg || 1)) * 100,
				isNegative: v < 0,
				fill: v >= 0 ? POSITIVE_BAR_COLOR : purple
			})),
			hasNegative: neg,
			posRatio: neg ? maxPos / (maxPos + maxNeg) : 1
		}
	}, [series])

	if (series.length === 0) return null

	const posHeight = `${posRatio * 100}%`
	const negHeight = `${(1 - posRatio) * 100}%`
	const hoveredPoint = hoveredIndex == null ? undefined : series[hoveredIndex]

	return (
		<div className={className ?? 'my-auto h-[132px]'}>
			<div ref={containerRef} className="relative h-full" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
				<div className="flex items-end" style={{ height: posHeight }}>
					{bars.map((bar) => (
						<div key={bar.timestamp} className="flex h-full flex-1 items-end justify-center">
							{!bar.isNegative ? (
								<div
									className="min-h-px w-[70%] min-w-[2px]"
									style={{ height: `${bar.heightPct}%`, backgroundColor: bar.fill }}
								/>
							) : null}
						</div>
					))}
				</div>
				{hasNegative ? (
					<div className="flex items-start" style={{ height: negHeight }}>
						{bars.map((bar) => (
							<div key={bar.timestamp} className="flex h-full flex-1 items-start justify-center">
								{bar.isNegative ? (
									<div
										className="min-h-px w-[70%] min-w-[2px]"
										style={{ height: `${bar.heightPct}%`, backgroundColor: bar.fill }}
									/>
								) : null}
							</div>
						))}
					</div>
				) : null}
				{hoveredIndex != null && hoveredPoint ? (
					<div
						className={domChartCrosshairStyles}
						style={{ left: `${((hoveredIndex + 0.5) / series.length) * 100}%` }}
					/>
				) : null}
				{hoveredPoint ? (
					<div ref={tooltipRef} className={domChartTooltipStyles}>
						<p>{formatTooltipChartDate(hoveredPoint[0], groupBy ?? 'daily')}</p>
						<p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							<span
								style={{
									display: 'inline-block',
									width: '10px',
									height: '10px',
									borderRadius: '50%',
									backgroundColor: hoveredPoint[1] >= 0 ? POSITIVE_BAR_COLOR : purple
								}}
							/>
							{formatUsd(hoveredPoint[1], {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</p>
					</div>
				) : null}
			</div>
		</div>
	)
}
