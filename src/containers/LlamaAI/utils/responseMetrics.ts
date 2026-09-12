import { formatUsd } from '~/utils/numberFormat'

export function formatResponseCost(usd: number) {
	return usd > 0 && usd < 0.000001
		? '<$0.000001'
		: formatUsd(usd, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function formatResponseDuration(ms: number) {
	const seconds = Math.max(0, Math.floor(ms / 1000))
	const minutes = Math.floor(seconds / 60)
	return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
}
