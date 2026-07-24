import { formatPercentChange } from '~/utils/numberFormat'

export const formatPnlPercent = (value: number) => {
	if (!Number.isFinite(value)) return '0%'
	return formatPercentChange(value)
}

export const formatDateLabel = (timestamp: number) => {
	return new Date(timestamp * 1000).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	})
}
