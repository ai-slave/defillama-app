import { chartColor } from '~/constants/colors'
import { domChartCrosshairStyles, domChartTooltipStyles } from '~/ui/ChartTooltip'
import { slug } from '~/utils'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useSmolChartHover } from './useSmolChartHover'

const BAR_COLOR = chartColor(0)
const HOVERED_BAR_COLOR = chartColor(1)

export function FeesGeneratedChart({ series }: { series: Array<[string, number, string]> }) {
	const { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave } = useSmolChartHover(series.length)

	if (series.length === 0) return null

	const maxVal = Math.max(...series.map((s) => s[1])) || 1
	const hoveredPoint = hoveredIndex == null ? undefined : series[hoveredIndex]

	return (
		<div className="flex-1 cursor-pointer">
			{/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer tracking for the hover readout; the values are in the chart itself. */}
			<div
				ref={containerRef}
				className="relative h-full"
				onMouseMove={onMouseMove}
				onMouseLeave={onMouseLeave}
				onClick={() => {
					if (hoveredPoint) {
						window.open(`/fees/${slug(hoveredPoint[0])}`)
					}
				}}
			>
				<div className="flex h-[calc(100%-22px)] items-end">
					{series.map((s, i) => (
						<div key={s[0]} className="flex h-full flex-1 items-end justify-center">
							<div
								className="w-[70%] min-w-[4px]"
								style={{
									height: `${(s[1] / maxVal) * 100}%`,
									backgroundColor: hoveredIndex === i ? HOVERED_BAR_COLOR : BAR_COLOR
								}}
							/>
						</div>
					))}
				</div>
				<div className="mt-1 flex h-[18px] items-center">
					{series.map((s, i) => (
						<div key={s[0]} className="flex flex-1 items-center justify-center">
							<img src={s[2]} alt={s[0]} className="size-[18px] rounded-full" loading="lazy" decoding="async" />
						</div>
					))}
				</div>
				{hoveredIndex != null && hoveredPoint ? (
					<div
						className={domChartCrosshairStyles}
						style={{ left: `${((hoveredIndex + 0.5) / series.length) * 100}%` }}
					/>
				) : null}
				{hoveredPoint ? (
					<div ref={tooltipRef} className={domChartTooltipStyles}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							<img
								src={hoveredPoint[2]}
								style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0 }}
								alt=""
							/>
							{hoveredPoint[0]}
							&nbsp;&nbsp;$
							{formatCompactNumber(hoveredPoint[1], {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}
