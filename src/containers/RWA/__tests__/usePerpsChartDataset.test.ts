import { describe, expect, test } from 'vitest'
import { getRwaPerpsChartUrl } from '../usePerpsChartDataset'

describe('getRwaPerpsChartUrl', () => {
	test('builds the split and contract routes with the server keys and the CEX flag', () => {
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'split', breakdown: 'venue' }, metric: 'openInterest', includeCex: true })
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true')
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'split', breakdown: 'baseAsset' }, metric: 'volume', includeCex: false })
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=volume24h')
		expect(getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric: 'openInterest', includeCex: false })).toBe(
			'/api/public/rwa/perps/contract-breakdown?key=openInterest'
		)
	})
})
