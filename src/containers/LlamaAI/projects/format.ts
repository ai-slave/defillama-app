import { formatFixedNumber } from '~/utils/numberFormat'

export function formatProjectBytes(value: number | string): string {
	const bytes = Number(value)
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${formatFixedNumber(bytes / 1024, 1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${formatFixedNumber(bytes / (1024 * 1024), 1)} MB`
	return `${formatFixedNumber(bytes / (1024 * 1024 * 1024), 2)} GB`
}
