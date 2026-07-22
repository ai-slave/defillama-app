import { describe, expect, it } from 'vitest'
import type { StablecoinListAsset } from '../api.types'
import { buildTotalMcapPayload } from '../chartSeries'
import { buildOverviewChartInputs, normalizeStablecoinBridges } from '../queries.server'

describe('stablecoin server query helpers', () => {
	it('normalizes bridge payloads while ignoring optional or missing bridge fields', () => {
		expect(
			normalizeStablecoinBridges({
				celer: {
					Ethereum: { amount: 10 },
					Polygon: {},
					Base: null
				},
				layerzero: {
					Arbitrum: { amount: 0 },
					Optimism: { amount: '12' }
				},
				empty: {},
				invalid: null
			})
		).toEqual({
			celer: {
				Ethereum: { amount: 10 }
			},
			layerzero: {
				Arbitrum: { amount: 0 },
				Optimism: { amount: 12 }
			}
		})
	})

	it('returns null when no bridge source has a finite amount', () => {
		expect(
			normalizeStablecoinBridges({
				celer: {
					Ethereum: {},
					Polygon: { amount: 'not-a-number' }
				}
			})
		).toBeNull()
	})

	it('keeps duplicate display names as distinct asset-ID chart histories', () => {
		const baseAsset = {
			name: 'USDA',
			symbol: 'USDA',
			gecko_id: null,
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			price: 1,
			circulating: { peggedUSD: 1 },
			circulatingPrevDay: { peggedUSD: 1 },
			circulatingPrevWeek: { peggedUSD: 1 },
			circulatingPrevMonth: { peggedUSD: 1 },
			chainCirculating: {}
		} satisfies Omit<StablecoinListAsset, 'id'>
		const inputs = buildOverviewChartInputs({
			peggedAssets: [
				{ ...baseAsset, id: '405' },
				{ ...baseAsset, id: '192' }
			],
			breakdown: {
				'405': [{ date: '1', totalCirculatingUSD: { peggedUSD: 40 } }],
				'192': [{ date: '1', totalCirculatingUSD: { peggedUSD: 85 } }]
			}
		})

		expect(inputs.peggedAssetIdToChartDataIndex).toEqual({ '192': 1, '405': 0 })
		expect(inputs.peggedAssetNames).toEqual(['USDA', 'USDA (192)'])
		expect(inputs.chartDataByPeggedAsset.map((history) => history[0].mcap.peggedUSD)).toEqual([40, 85])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: inputs.chartDataByPeggedAsset,
				assetsOrChainsList: inputs.peggedAssetNames,
				filteredIndexes: inputs.chartDataByPeggedAsset.map((_, index) => index),
				issuanceType: 'mcap',
				selectedChain: 'All'
			}).dataset.source
		).toEqual([[1_000, 125]])
	})

	it('keeps stale histories compact for canonical carry-forward construction', () => {
		const asset = (id: string, name: string): StablecoinListAsset => ({
			id,
			name,
			symbol: name,
			gecko_id: null,
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			price: 1,
			circulating: { peggedUSD: 1 },
			circulatingPrevDay: { peggedUSD: 1 },
			circulatingPrevWeek: { peggedUSD: 1 },
			circulatingPrevMonth: { peggedUSD: 1 },
			chainCirculating: {}
		})
		const inputs = buildOverviewChartInputs({
			peggedAssets: [asset('stale', 'Stale'), asset('current', 'Current')],
			breakdown: {
				stale: [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }],
				current: [
					{ date: '1', totalCirculatingUSD: { peggedUSD: 20 } },
					{ date: '86401', totalCirculatingUSD: { peggedUSD: 30 } }
				]
			}
		})

		expect(inputs.chartDataByPeggedAsset.map((series) => series.length)).toEqual([1, 2])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: inputs.chartDataByPeggedAsset,
				assetsOrChainsList: inputs.peggedAssetNames,
				issuanceType: 'mcap',
				selectedChain: 'All',
				carryForwardAfterSeriesEnd: true
			}).dataset.source
		).toEqual([
			[1_000, 30],
			[86_401_000, 40]
		])
	})
})
