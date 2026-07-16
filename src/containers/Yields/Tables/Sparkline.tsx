// Inline SVG sparkline for the /yields "30d Trend" column. Uses the yields colour
// family (--apy-mid up, --apy-very down, --text-tertiary flat) so the sparkline speaks
// the same green/red as stability, signed APYs and the charts.
// `null` entries are missing days (gaps) and must never be plotted as zero.
import { EmptyCell } from './YieldsCells'

interface SparklineProps {
	points?: Array<number | null> | null
	width?: number
	height?: number
}

export function Sparkline({ points, width = 84, height = 24 }: SparklineProps) {
	const vals = points ?? []
	const n = vals.length

	let min = Infinity
	let max = -Infinity
	let count = 0
	let first: number | null = null
	let last: number | null = null
	let firstIdx = -1
	let lastIdx = -1
	for (let i = 0; i < n; i += 1) {
		const v = vals[i]
		if (v == null) continue
		count += 1
		if (first === null) {
			first = v
			firstIdx = i
		}
		last = v
		lastIdx = i
		if (v < min) min = v
		if (v > max) max = v
	}

	// Fewer than two real points is not a trend — render the shared empty placeholder (the em
	// dash the column aligns) rather than a lone degenerate dot floating off-centre.
	if (count < 2 || first === null || last === null) {
		return <EmptyCell />
	}

	const xPad = 2
	const yPad = 3
	// Stretch the populated range (first→last real point) across the full width so
	// the trend fills the box regardless of how many days have data.
	const range = Math.max(1, lastIdx - firstIdx)
	const span = max - min
	const xAt = (i: number) => xPad + ((i - firstIdx) / range) * (width - xPad * 2)
	const yAt = (v: number) => (span > 0 ? height - yPad - ((v - min) / span) * (height - yPad * 2) : height / 2)

	let d = ''
	let endX = 0
	let endY = 0
	for (let i = 0; i < n; i += 1) {
		const v = vals[i]
		if (v == null) continue
		endX = xAt(i)
		endY = yAt(v)
		d += `${d ? ' L' : 'M'} ${endX.toFixed(2)} ${endY.toFixed(2)}`
	}

	const color = last > first ? 'var(--apy-mid)' : last < first ? 'var(--apy-very)' : 'var(--text-tertiary)'

	return (
		<svg
			className="block max-w-none shrink-0"
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden
			focusable="false"
			style={{ color }}
		>
			<path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
			<circle cx={endX.toFixed(2)} cy={endY.toFixed(2)} r={1.7} fill="currentColor" />
		</svg>
	)
}
