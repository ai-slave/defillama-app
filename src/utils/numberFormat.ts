const NUMBER_LOCALE = 'en-US'

type SignDisplay = 'auto' | 'always' | 'exceptZero' | 'never'
type NumericValue = number | string
type CompactSuffix = 'uppercase' | 'lowercase'

interface PrecisionOptions {
	minimumFractionDigits?: number
	maximumFractionDigits?: number
	maximumSignificantDigits?: number
}

export interface FormatNumberOptions extends PrecisionOptions {
	useGrouping?: boolean
	signDisplay?: SignDisplay | undefined
	currency?: string
}

export interface FormatCompactNumberOptions extends PrecisionOptions {
	/** Controls K/M/B/T casing without changing the compact threshold. */
	compactSuffix?: CompactSuffix
	signDisplay?: SignDisplay
	/** Values below this absolute magnitude remain fully expanded. Defaults to 1,000. */
	minimumCompactValue?: number
}

export interface FormatUsdOptions extends PrecisionOptions {
	compact?: boolean
	compactSuffix?: CompactSuffix
	/** Values below this absolute magnitude remain fully expanded. Defaults to 1,000. */
	minimumCompactValue?: number
	signDisplay?: SignDisplay
}

export interface FormatPercentOptions extends PrecisionOptions {
	/** Fractions are multiplied by 100; percent values are displayed as supplied. */
	input: 'fraction' | 'percent'
	compact?: boolean
	compactSuffix?: CompactSuffix
	minimumCompactValue?: number
	signDisplay?: SignDisplay
	useGrouping?: boolean
	/** Show tiny non-zero values as a threshold even when fixed trailing digits are requested. */
	smallValueDisplay?: 'rounded' | 'threshold'
}

export const USD_LOWERCASE_MILLIONS_OPTIONS = {
	compact: true,
	minimumCompactValue: 1_000_000,
	compactSuffix: 'lowercase'
} as const

export const NUMBER_LOWERCASE_MILLIONS_OPTIONS = { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

export const PERCENT_POINTS_TWO_DECIMALS_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false
} as const

/** Produces fixed decimal text for protocols that require exact trailing digits. */
export function formatFixedNumber(value: number, fractionDigits?: number): string
export function formatFixedNumber(value: null | undefined, fractionDigits?: number): null
export function formatFixedNumber(value: number | null | undefined, fractionDigits = 0): string | null {
	return value == null ? null : value.toFixed(fractionDigits)
}

/** Rounds a number through the same fixed-decimal behavior as formatFixedNumber. */
export function roundNumber(value: number, fractionDigits = 0): number {
	return Number(formatFixedNumber(value, fractionDigits))
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = JSON.stringify(options)
	let formatter = formatterCache.get(key)
	if (!formatter) {
		formatter = new Intl.NumberFormat(NUMBER_LOCALE, options)
		formatterCache.set(key, formatter)
	}
	return formatter
}

function finiteValue(value: NumericValue | null | undefined): number | null {
	if (value == null || value === '') return null
	const number = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(number)) return null
	return Object.is(number, -0) ? 0 : number
}

function precisionOptions(options: PrecisionOptions): PrecisionOptions {
	return {
		...(options.minimumFractionDigits == null ? {} : { minimumFractionDigits: options.minimumFractionDigits }),
		...(options.maximumFractionDigits == null ? {} : { maximumFractionDigits: options.maximumFractionDigits }),
		...(options.maximumSignificantDigits == null ? {} : { maximumSignificantDigits: options.maximumSignificantDigits })
	}
}

function applyCompactSuffixCase(value: string, compactSuffix: CompactSuffix | undefined): string {
	return compactSuffix === 'lowercase' ? value.replace(/([KMBT])$/, (suffix) => suffix.toLowerCase()) : value
}

function adaptiveFractionDigits(value: number, meaningfulDigits: number, minimum: number): number {
	const absoluteValue = Math.abs(value)
	if (absoluteValue === 0 || absoluteValue >= 1) return minimum
	const leadingFractionalZeros = Math.max(0, Math.ceil(-Math.log10(absoluteValue)) - 1)
	return Math.min(10, Math.max(minimum, leadingFractionalZeros + meaningfulDigits))
}

/**
 * Compact displays keep the app's established precision: K/M values show up to
 * two decimals, while B/T values show up to three. These are maximums, so Intl
 * omits trailing zeros (16.763B, 7.91B, 3.3B).
 */
function compactFractionDigits(value: number): number {
	return Math.abs(value) >= 1_000_000_000 ? 3 : 2
}

/** Formats a grouped, fully expanded number. This function never abbreviates. */
export function formatNumber(value: NumericValue, options?: FormatNumberOptions): string
export function formatNumber(value: null | undefined, options?: FormatNumberOptions): null
export function formatNumber(value: NumericValue | null | undefined, options?: FormatNumberOptions): string | null
export function formatNumber(value: NumericValue | null | undefined, options: FormatNumberOptions = {}): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	const { currency, signDisplay = 'auto', useGrouping = true } = options
	return getFormatter({
		...(currency ? { style: 'currency', currency } : {}),
		useGrouping,
		signDisplay,
		maximumFractionDigits: options.maximumFractionDigits ?? adaptiveFractionDigits(number, 2, 2),
		...(options.minimumFractionDigits == null ? {} : { minimumFractionDigits: options.minimumFractionDigits }),
		...(options.maximumSignificantDigits == null ? {} : { maximumSignificantDigits: options.maximumSignificantDigits })
	}).format(number)
}

/** Formats large magnitudes with K/M/B/T suffixes. */
export function formatCompactNumber(value: NumericValue, options?: FormatCompactNumberOptions): string
export function formatCompactNumber(value: null | undefined, options?: FormatCompactNumberOptions): null
export function formatCompactNumber(
	value: NumericValue | null | undefined,
	options?: FormatCompactNumberOptions
): string | null
export function formatCompactNumber(
	value: NumericValue | null | undefined,
	options: FormatCompactNumberOptions = {}
): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	if (Math.abs(number) < (options.minimumCompactValue ?? 1000)) {
		return formatNumber(number, {
			signDisplay: options.signDisplay,
			...precisionOptions(options)
		})
	}
	const formatted = getFormatter({
		notation: 'compact',
		compactDisplay: 'short',
		signDisplay: options.signDisplay ?? 'auto',
		maximumFractionDigits: options.maximumFractionDigits ?? compactFractionDigits(number),
		...(options.minimumFractionDigits == null ? {} : { minimumFractionDigits: options.minimumFractionDigits }),
		...(options.maximumSignificantDigits == null ? {} : { maximumSignificantDigits: options.maximumSignificantDigits })
	}).format(number)
	return applyCompactSuffixCase(formatted, options.compactSuffix)
}

/** Formats USD values, optionally using the same compact suffix policy as formatCompactNumber. */
export function formatUsd(value: NumericValue, options?: FormatUsdOptions): string
export function formatUsd(value: null | undefined, options?: FormatUsdOptions): null
export function formatUsd(value: NumericValue | null | undefined, options?: FormatUsdOptions): string | null
export function formatUsd(value: NumericValue | null | undefined, options: FormatUsdOptions = {}): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	const absoluteValue = Math.abs(number)
	const compact = options.compact && absoluteValue >= (options.minimumCompactValue ?? 1000)
	// Without caller precision, expanded amounts show whole dollars from $1,000 and full cents below it
	// ($5.40, never $5.4). Exact integers stay whole ($5, $0) so axis ticks and prices read naturally.
	// Callers that need other precision (prices, balances) pass their own.
	const defaultCents =
		!compact && absoluteValue < 1000 && options.minimumFractionDigits == null && options.maximumFractionDigits == null
	const minimumFractionDigits = options.minimumFractionDigits ?? (defaultCents ? 2 : 0)
	const maximumFractionDigits =
		options.maximumFractionDigits ??
		(compact
			? compactFractionDigits(number)
			: absoluteValue >= 1000
				? minimumFractionDigits
				: adaptiveFractionDigits(number, 2, 2))
	const formatted = getFormatter({
		style: 'currency',
		currency: 'USD',
		...(compact ? { notation: 'compact', compactDisplay: 'short' } : {}),
		signDisplay: options.signDisplay ?? 'auto',
		maximumFractionDigits,
		minimumFractionDigits,
		...(defaultCents ? { trailingZeroDisplay: 'stripIfInteger' } : {}),
		...(options.maximumSignificantDigits == null ? {} : { maximumSignificantDigits: options.maximumSignificantDigits })
	}).format(number)
	return applyCompactSuffixCase(formatted, options.compactSuffix)
}

/** Formats ratios and preserves tiny non-zero values as threshold labels instead of zero. */
export function formatRatio(value: NumericValue, options?: PrecisionOptions): string
export function formatRatio(value: null | undefined, options?: PrecisionOptions): null
export function formatRatio(value: NumericValue | null | undefined, options?: PrecisionOptions): string | null
export function formatRatio(value: NumericValue | null | undefined, options: PrecisionOptions = {}): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	const maximumFractionDigits = options.maximumFractionDigits ?? 2
	const threshold = 10 ** -maximumFractionDigits
	if (number !== 0 && Math.abs(number) < threshold) {
		const thresholdLabel = formatNumber(threshold, {
			minimumFractionDigits: maximumFractionDigits,
			maximumFractionDigits
		})
		return number < 0 ? `>-${thresholdLabel}` : `<${thresholdLabel}`
	}
	return formatNumber(value, {
		...precisionOptions(options),
		maximumFractionDigits
	})
}

/** Formats a percentage using an explicit fraction-or-percent input contract. */
export function formatPercent(value: NumericValue, options: FormatPercentOptions): string
export function formatPercent(value: null | undefined, options: FormatPercentOptions): null
export function formatPercent(value: NumericValue | null | undefined, options: FormatPercentOptions): string | null
export function formatPercent(value: NumericValue | null | undefined, options: FormatPercentOptions): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	const percent = options.input === 'fraction' ? number * 100 : number
	const compact = options.compact && Math.abs(percent) >= (options.minimumCompactValue ?? 1000)
	const maximumFractionDigits =
		options.maximumFractionDigits ?? (compact ? compactFractionDigits(percent) : adaptiveFractionDigits(percent, 2, 2))
	const formatted = applyCompactSuffixCase(
		getFormatter({
			...(compact ? { notation: 'compact', compactDisplay: 'short' } : {}),
			signDisplay: options.signDisplay ?? 'auto',
			useGrouping: options.useGrouping ?? true,
			maximumFractionDigits,
			...(options.minimumFractionDigits == null ? {} : { minimumFractionDigits: options.minimumFractionDigits }),
			...(options.maximumSignificantDigits == null
				? {}
				: { maximumSignificantDigits: options.maximumSignificantDigits })
		}).format(percent),
		options.compactSuffix
	)
	const showTinyThreshold =
		options.smallValueDisplay === 'threshold' ||
		(options.smallValueDisplay == null && options.minimumFractionDigits == null)
	if (showTinyThreshold && percent !== 0 && Number(formatted.replaceAll(',', '')) === 0) {
		const threshold = 10 ** -maximumFractionDigits
		const thresholdLabel = formatFixedNumber(threshold, maximumFractionDigits)
		return percent < 0 ? `>-${thresholdLabel}%` : `<${thresholdLabel}%`
	}
	return `${formatted}%`
}

/** Formats an already-percent change with a sign and stable change precision. */
export function formatPercentChange(value: NumericValue): string
export function formatPercentChange(value: null | undefined): null
export function formatPercentChange(value: NumericValue | null | undefined): string | null
export function formatPercentChange(value: NumericValue | null | undefined): string | null {
	const number = finiteValue(value)
	if (number == null) return null
	if (number === 0) return '0%'
	if (Math.abs(number) < 0.0001) return number < 0 ? '>-0.0001%' : '<0.0001%'
	return (
		formatPercent(number, {
			input: 'percent',
			maximumFractionDigits: Math.abs(number) > 100 ? 0 : 2,
			minimumFractionDigits: Math.abs(number) > 100 ? 0 : 2
		})?.replace(/^/, number > 0 ? '+' : '') ?? null
	)
}
