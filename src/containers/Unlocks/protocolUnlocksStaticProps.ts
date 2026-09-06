import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import { getProtocolEmissons } from '~/containers/Unlocks/queries'
import { slug } from '~/utils'
import type { ITokenListEntry } from '~/utils/metadata/types'
import { getCliffEmissionAmount } from './eventAmount'
import type { ProtocolEmissionResult } from './types'

export function calculateTotalUnlockValue(
	emissions: Pick<ProtocolEmissionResult, 'tokenPrice' | 'upcomingEvent'>
): number | null {
	const price = emissions.tokenPrice?.price
	if (price == null || price <= 0) return null

	let totalAmount = 0
	let hasKnownCliffAmount = false
	for (const event of emissions.upcomingEvent) {
		const amount = getCliffEmissionAmount(event)
		if (amount === null) continue
		hasKnownCliffAmount = true
		if (amount > 0) totalAmount += amount
	}

	return hasKnownCliffAmount ? totalAmount * price : null
}

export function getEventCountdown(timestamp: number | null | undefined): string {
	if (!timestamp) return ''
	const now = Math.floor(Date.now() / 1000)
	const timeLeft = timestamp - now

	if (timeLeft <= 0) return 'now'

	const hoursLeft = Math.floor(timeLeft / 3600)
	const daysLeft = Math.floor(hoursLeft / 24)
	const minutesLeft = Math.floor(timeLeft / 60)

	if (daysLeft >= 1) {
		return `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
	}

	if (hoursLeft >= 1) {
		return `in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`
	}

	if (minutesLeft >= 1) {
		return `in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`
	}

	return 'in less than a minute'
}

export async function getProtocolUnlocksStaticPropsData(
	protocolParam: string,
	tokenlist: Record<string, ITokenListEntry>,
	emissionsProtocolsList: Array<string>
) {
	const normalizedName = slug(protocolParam)
	if (!emissionsProtocolsList.includes(normalizedName)) {
		return {
			normalizedName,
			emissions: null,
			geckoId: null,
			tokenSymbol: null,
			initialTokenMarketData: null
		}
	}

	const emissions = await getProtocolEmissons(normalizedName, {
		emissionsProtocolsList,
		tokenlist
	})
	if (emissions.name === null) {
		return {
			normalizedName,
			emissions: null,
			geckoId: null,
			tokenSymbol: null,
			initialTokenMarketData: null
		}
	}

	const geckoId = emissions.geckoId ?? emissions.meta?.gecko_id ?? null
	const tokenEntry = geckoId ? (tokenlist[geckoId] ?? null) : null
	const cgChart = geckoId
		? await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, {
				timeframe: '1Y',
				includeCoinData: true
			}).catch(() => null)
		: null
	const cgMarketData = cgChart?.data?.coinData?.market_data
	const tokenSymbol = emissions.tokenPrice.symbol ?? tokenEntry?.symbol?.toUpperCase() ?? null
	const initialTokenMarketData = tokenEntry
		? {
				price: tokenEntry.current_price ?? null,
				prevPrice:
					tokenEntry.current_price != null && tokenEntry.price_change_24h != null
						? tokenEntry.current_price - tokenEntry.price_change_24h
						: null,
				priceChangePercent: tokenEntry.price_change_percentage_24h ?? null,
				mcap: tokenEntry.market_cap ?? null,
				volume24h: tokenEntry.total_volume ?? null,
				circSupply: tokenEntry.circulating_supply ?? null,
				maxSupply: tokenEntry.max_supply ?? null,
				maxSupplyInfinite: cgMarketData?.max_supply_infinite ?? null
			}
		: null

	return {
		normalizedName,
		emissions,
		geckoId,
		tokenSymbol,
		initialTokenMarketData
	}
}
