import { expect, test } from 'vitest'
import { getRwaPerpsFilterDefinitions, getRwaVenueTypeQueryPatch } from '../perpsFilters'
import { filterRwaPerpsPageMarkets } from '../perpsPageMarkets'
import { perpsAsset } from '../table/__tests__/fixtures'

test('lists a suspicious market in the table but leaves it out of Key Metrics, the cards and the chart', () => {
	const markets = [
		perpsAsset({ id: 'gold', contract: 'xyz:GOLD', venueType: 'DEX' }),
		perpsAsset({ id: 'flagged', contract: 'xyz:FLAG', venueType: 'DEX', suspicious: true }),
		perpsAsset({ id: 'nvda', contract: 'bn:NVDA', venue: 'Binance', venueType: 'CEX' })
	]
	const query = getRwaVenueTypeQueryPatch('dex')
	const { filteredAssets, aggregateAssets } = filterRwaPerpsPageMarkets(
		markets,
		query,
		getRwaPerpsFilterDefinitions(markets, 'perpsOverview', query)
	)
	expect(filteredAssets.map((market) => market.id)).toEqual(['gold', 'flagged'])
	expect(aggregateAssets.map((market) => market.id)).toEqual(['gold'])
})
