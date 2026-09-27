import { formatPercentChange } from '~/utils/numberFormat'

interface PercentChangeDisplay {
	finalValue: string
	isPositive: boolean
	isNegative: boolean
}

function getPercentChangeDisplay(percent: unknown, noSign?: boolean): PercentChangeDisplay | null {
	if (!percent && percent !== 0) {
		return null
	}

	// Use Number() not parseFloat() — parseFloat("12abc") silently returns 12
	const parsedPercent =
		typeof percent === 'number' ? percent : typeof percent === 'string' ? Number(percent) : Number.NaN
	if (!Number.isFinite(parsedPercent)) {
		return null
	}
	let isPositive = false
	let isNegative = false
	if (parsedPercent > 0) isPositive = true
	if (parsedPercent < 0) isNegative = true
	const formatted = formatPercentChange(parsedPercent)
	if (!formatted) return null
	const finalValue = noSign ? formatted.replace(/^\+/, '') : formatted

	return { finalValue, isPositive, isNegative }
}

interface PercentChangeProps {
	percent: unknown
	noSign?: boolean
	fontWeight?: number
}

export function formatPercentChangeText(percent: unknown, noSign?: boolean): string | null {
	return getPercentChangeDisplay(percent, noSign)?.finalValue ?? null
}

export function PercentChange({ percent, noSign, fontWeight }: PercentChangeProps): React.JSX.Element | null {
	const display = getPercentChangeDisplay(percent, noSign)
	if (!display) {
		return null
	}

	const colorClass = noSign ? '' : display.isPositive ? 'text-data-up' : display.isNegative ? 'text-data-down' : ''
	const weight = fontWeight ?? 400

	return weight > 400 ? (
		<span className={colorClass} style={{ fontWeight: weight }}>
			{display.finalValue}
		</span>
	) : (
		<span className={colorClass}>{display.finalValue}</span>
	)
}
