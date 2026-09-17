import { useMemo } from 'react'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { domChartCrosshairStyles, domChartTooltipStyles } from '~/ui/ChartTooltip'
import { formatCompactNumber } from '~/utils/numberFormat'
import { getChainOverviewPaletteColor } from './constants'
import { useSmolChartHover } from './useSmolChartHover'

const COLOR_MAP = {
	blue: { dark: getChainOverviewPaletteColor(0), light: getChainOverviewPaletteColor(0) },
	green: { dark: '#3fb84f', light: '#008a13' },
	red: { dark: '#e24a42', light: '#e60d02' }
} as const

export function smoothPath(points: Array<[number, number]>): string {
	const first = points[0]
	const second = points[1]
	if (!first || !second) return ''
	if (points.length === 2) return `M${first[0]},${first[1]} L${second[0]},${second[1]}`

	let d = `M${first[0]},${first[1]}`
	let p0 = first
	let p1 = first
	let p2 = second
	for (let i = 0; i < points.length - 1; i++) {
		const p3 = points[i + 2] ?? p2

		const cp1x = p1[0] + (p2[0] - p0[0]) / 6
		const cp1y = p1[1] + (p2[1] - p0[1]) / 6
		const cp2x = p2[0] - (p3[0] - p1[0]) / 6
		const cp2y = p2[1] - (p3[1] - p1[1]) / 6

		d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
		p0 = p1
		p1 = p2
		p2 = p3
	}
	return d
}

export function SmolLineChart({
	series,
	color,
	className
}: {
	series: Array<[number, number]>
	color: keyof typeof COLOR_MAP
	className?: string
}) {
	const [isThemeDark] = useDarkModeManager()
	const { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave } = useSmolChartHover(series.length)

	const { pathD, stroke } = useMemo(() => {
		if (series.length === 0) return { pathD: '', stroke: '' }

		const values = series.map((s) => s[1])
		const min = Math.min(...values)
		const max = Math.max(...values)
		const range = max - min || 1

		const VB_W = 300
		const VB_H = 100
		const PAD = 2

		const pts: Array<[number, number]> = values.map((v, i) => {
			const x = series.length === 1 ? VB_W / 2 : (i / (series.length - 1)) * VB_W
			const y = PAD + ((max - v) / range) * (VB_H - PAD * 2)
			return [x, y]
		})

		const themeKey = isThemeDark ? 'dark' : 'light'
		return { pathD: smoothPath(pts), stroke: COLOR_MAP[color][themeKey] }
	}, [series, color, isThemeDark])

	if (series.length === 0) return null
	const hoveredPoint = hoveredIndex == null ? undefined : series[hoveredIndex]

	return (
		<div className={className ?? 'my-auto h-[112px]'}>
			<div ref={containerRef} className="relative h-full" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 300 100"
					preserveAspectRatio="none"
					style={{ overflow: 'visible' }}
				>
					<path d={pathD} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
				</svg>
				{hoveredIndex != null && hoveredPoint ? (
					<div
						className={domChartCrosshairStyles}
						style={{ left: `${series.length === 1 ? 50 : (hoveredIndex / (series.length - 1)) * 100}%` }}
					/>
				) : null}
				{hoveredPoint ? (
					<div ref={tooltipRef} className={domChartTooltipStyles}>
						<p>{formatTooltipChartDate(hoveredPoint[0], 'daily')}</p>
						<p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							<span
								style={{
									display: 'inline-block',
									width: '10px',
									height: '10px',
									borderRadius: '50%',
									backgroundColor: stroke
								}}
							/>
							$
							{formatCompactNumber(hoveredPoint[1], {
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
