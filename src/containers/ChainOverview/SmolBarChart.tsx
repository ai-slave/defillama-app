import { useMemo } from 'react'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { CHART_DOWN, CHART_UP, chartColor } from '~/constants/colors'
import { domChartCrosshairStyles, domChartTooltipStyles } from '~/ui/ChartTooltip'
import { formatUsd } from '~/utils/numberFormat'
import { useSmolChartHover } from './useSmolChartHover'

export function SmolBarChart({
	series,
	signed = false,
	className,
	groupBy
}: {
	series: Array<[number, number]>
	/** A net flow (ETF inflows): bars rise and fall in the up/down colors. Otherwise a total, in brand blue. */
	signed?: boolean
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
				fill: !signed ? chartColor(0) : v >= 0 ? CHART_UP : CHART_DOWN
			})),
			hasNegative: neg,
			posRatio: neg ? maxPos / (maxPos + maxNeg) : 1
		}
	}, [series, signed])

	if (series.length === 0) return null

	const posHeight = `${posRatio * 100}%`
	const negHeight = `${(1 - posRatio) * 100}%`
	const hoveredPoint = hoveredIndex == null ? undefined : series[hoveredIndex]
	const hoveredBar = hoveredIndex == null ? undefined : bars[hoveredIndex]

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
									backgroundColor: hoveredBar?.fill
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
