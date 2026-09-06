import { formatDate, formatDateTime, parseDateTimestamp } from '~/utils/dateFormat'
import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'

const DATE_DETECTION_SAMPLE_SIZE = 200
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const EPOCH_TIMESTAMP = /^(?:\d{10}|\d{13})$/
const DATE_HEADER = /(date|time|timestamp|day|unlock)/i
const TIMESTAMP_HEADER = /time|timestamp|(?:^|[_\s-])(?:updated|created|modified|at)(?:$|[_\s-])/i

export function downloadPreviewHasTime(header: string, values: Array<string>): boolean {
	if (TIMESTAMP_HEADER.test(header)) return true
	return values.slice(0, DATE_DETECTION_SAMPLE_SIZE).some((value) => parseDownloadPreviewDate(value, header)?.hasTime)
}

export function parseDownloadPreviewDate(
	value: string,
	header: string
): { timestamp: number; hasTime: boolean } | null {
	const trimmed = value.trim()
	const parsedStringTimestamp = parseDateTimestamp(trimmed)
	if (parsedStringTimestamp !== null) return { timestamp: parsedStringTimestamp, hasTime: !DATE_ONLY.test(trimmed) }

	if (!DATE_HEADER.test(header) || !EPOCH_TIMESTAMP.test(trimmed)) return null
	const timestamp = Number(trimmed)
	const timestampInMs = trimmed.length === 10 ? timestamp * 1000 : timestamp
	return parseDateTimestamp(timestampInMs, { input: 'milliseconds' }) === null
		? null
		: { timestamp: timestampInMs, hasTime: TIMESTAMP_HEADER.test(header) }
}

/** Date-only cells are UTC calendar facts; offset-bearing and numeric timestamp cells retain viewer-local time. */
export function formatDownloadPreviewDate(value: string, header: string): string | null {
	const parsed = parseDownloadPreviewDate(value, header)
	if (!parsed) return null
	return parsed.hasTime
		? formatDateTime(parsed.timestamp, { input: 'milliseconds', timeZone: 'local' })
		: formatDate(parsed.timestamp, { input: 'milliseconds' })
}

export function formatDownloadPreviewNumber(value: number): string {
	const absoluteValue = Math.abs(value)
	if (absoluteValue >= 1_000_000) return formatCompactNumber(value, { maximumFractionDigits: 2 })
	if (Number.isInteger(value)) return formatNumber(value, { maximumFractionDigits: 0 })
	if (absoluteValue >= 1) return formatNumber(value, { maximumFractionDigits: 2 })
	return formatNumber(value, { maximumFractionDigits: 6 })
}

export function formatDownloadPreviewCurrency(value: number): string {
	const absoluteValue = Math.abs(value)
	if (absoluteValue >= 10_000) return formatUsd(value, { compact: true, maximumFractionDigits: 2 })
	if (absoluteValue >= 1) return formatUsd(value, { maximumFractionDigits: 2 })
	return formatUsd(value, { maximumFractionDigits: 6 })
}

export function formatDownloadPreviewPercent(value: number): string {
	const absoluteValue = Math.abs(value)
	return formatPercent(value, {
		input: 'percent',
		compact: absoluteValue >= 1_000_000,
		maximumFractionDigits: Number.isInteger(value) ? 0 : absoluteValue >= 1 ? 2 : 6
	})
}
