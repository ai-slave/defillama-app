import * as React from 'react'
import { formatFixedNumber } from '~/utils/numberFormat'

function sparklinePoints(values: number[], width: number, height: number): string {
	if (values.length < 2) return ''
	const min = Math.min(...values)
	const max = Math.max(...values)
	const range = max - min
	return values
		.map((value, index) => {
			const x = (index / (values.length - 1)) * width
			const y = range === 0 ? height / 2 : height - ((value - min) / range) * height
			return `${formatFixedNumber(x, 1)},${formatFixedNumber(y, 1)}`
		})
		.join(' ')
}

export function MiniSparkline({ values, label }: { values: number[]; label: string }) {
	const points = React.useMemo(() => sparklinePoints(values, 112, 32), [values])
	if (!points) return <span className="text-tertiary">–</span>
	return (
		<svg
			viewBox="0 0 112 32"
			role="img"
			aria-label={label}
			className="ml-auto h-8 w-28 text-link"
			preserveAspectRatio="none"
		>
			<polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
		</svg>
	)
}
