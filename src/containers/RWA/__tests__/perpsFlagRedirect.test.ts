import { describe, expect, test } from 'vitest'
import { legacyRwaPerpsRedirect } from '../perpsFlagRedirect'

const redirect = (url: string) => {
	const parsed = new URL(url, 'https://defillama.com')
	return legacyRwaPerpsRedirect(parsed.pathname, parsed.searchParams)
}

describe('legacyRwaPerpsRedirect', () => {
	test('opens the Perps overview without the flag, under both of its names', () => {
		expect(redirect('/rwa?perps=true')).toBe('/rwa/perps')
		expect(redirect('/rwa?includeRwaPerps=true')).toBe('/rwa/perps')
	})

	test('keeps every other key of the query, in its order', () => {
		expect(redirect('/rwa?perps=true&groupBy=assetGroup')).toBe('/rwa/perps?groupBy=assetGroup')
		expect(redirect('/rwa?groupBy=platform&perps=true&includeCex=false')).toBe(
			'/rwa/perps?groupBy=platform&includeCex=false'
		)
		expect(redirect('/rwa?assetClasses=Forex%20Perps&perps=true')).toBe('/rwa/perps?assetClasses=Forex+Perps')
	})

	test('reads a flag appended with a second question mark as the query it meant', () => {
		expect(redirect('/rwa?groupBy=assetGroup?perps=true')).toBe('/rwa/perps?groupBy=assetGroup')
		expect(redirect('/rwa?perps=true?groupBy=asset')).toBe('/rwa/perps?groupBy=asset')
		// The server hands the proxy that second "?" encoded.
		expect(redirect('/rwa?groupBy=assetGroup%3Fperps%3Dtrue')).toBe('/rwa/perps?groupBy=assetGroup')
	})

	test('keeps the scope of an asset group and a platform', () => {
		expect(redirect('/rwa/asset-group/private-credit?includeRwaPerps=true')).toBe(
			'/rwa/perps/asset-group/private-credit'
		)
		expect(redirect('/rwa/asset-group/public-equities?perps=true&includeCex=false')).toBe(
			'/rwa/perps/asset-group/public-equities?includeCex=false'
		)
		expect(redirect('/rwa/platform/ondo?perps=true&groupBy=asset')).toBe('/rwa/platform/ondo?groupBy=asset')
	})

	test('sends every other /rwa page outside the Perps tree to the Perps overview', () => {
		expect(redirect('/rwa/chain/ethereum?perps=true&groupBy=platform')).toBe('/rwa/perps?groupBy=platform')
		expect(redirect('/rwa/category/treasuries?perps=true')).toBe('/rwa/perps')
		expect(redirect('/rwa/asset-group?perps=true')).toBe('/rwa/perps')
	})

	test('moves an old Perps dashboard volume period from groupBy to flowMode', () => {
		expect(redirect('/rwa/perps?groupBy=weekly')).toBe('/rwa/perps?flowMode=weekly')
		expect(redirect('/rwa/perps/venue/binance?includeCex=false&groupBy=monthly')).toBe(
			'/rwa/perps/venue/binance?includeCex=false&flowMode=monthly'
		)
		expect(redirect('/rwa/perps/asset-group/public-equities?groupBy=weekly')).toBe(
			'/rwa/perps/asset-group/public-equities?flowMode=weekly'
		)
		expect(redirect('/rwa/perps/asset/gold?groupBy=monthly')).toBe('/rwa/perps/asset/gold?flowMode=monthly')
	})

	test('moves an old Perps dashboard chart pick from stacks to chartSeries', () => {
		expect(redirect('/rwa/perps?stacks=Binance&stacks=trade%5BXYZ%5D')).toBe(
			'/rwa/perps?chartSeries=Binance&chartSeries=trade%5BXYZ%5D'
		)
		expect(redirect('/rwa/perps/venue/binance?excludeStacks=NVIDIA&groupBy=weekly')).toBe(
			'/rwa/perps/venue/binance?excludeChartSeries=NVIDIA&flowMode=weekly'
		)
	})

	test('leaves the Perps tree, its contract page, a flag that is off and other sections alone', () => {
		expect(redirect('/rwa/perps?perps=true')).toBeNull()
		expect(redirect('/rwa/perps?groupBy=asset')).toBeNull()
		expect(redirect('/rwa/perps/venue/binance?perps=true')).toBeNull()
		expect(redirect('/rwa/perps/contract/xyz-gold?groupBy=weekly')).toBeNull()
		expect(redirect('/rwa?stacks=Binance')).toBeNull()
		expect(redirect('/rwa?perps=false')).toBeNull()
		expect(redirect('/rwa?groupBy=assetGroup')).toBeNull()
		expect(redirect('/stablecoins?perps=true')).toBeNull()
		expect(redirect('/rwaa?perps=true')).toBeNull()
	})
})
