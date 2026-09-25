import type { CoinsChartResponse } from '~/api/types'
import { getPercentChange } from '~/utils'

/** Hacks and raises carry a display name, not a slug, so both sides reduce to bare alphanumerics. */
export function matchesDefillamaCex(name: string, defillamaCexSlug: string): boolean {
	const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
	const normalizedCexSlug = defillamaCexSlug.replace(/-cex$/, '').replace(/[^a-z0-9]/g, '')
	return normalizedName === normalizedCexSlug
}

export function nativeTokenChange24h(
	priceUsd: number | null,
	priceKey: string | null,
	history: CoinsChartResponse
): number | null {
	if (priceUsd == null || !priceKey) return null
	const previousPrice = history.coins?.[priceKey]?.prices?.find((point) => Number.isFinite(point.price))?.price
	return getPercentChange(priceUsd, previousPrice)
}
