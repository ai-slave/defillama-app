import { describe, expect, it } from 'vitest'
import { sumRwaMetricBreakdown } from '~/containers/ProDashboard/rwaMetrics'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { buildRWAAllChainsAssetTableRows, buildRWAChainAssetTableRows } from './rwaAssetsTableData'

function asset(overrides: Partial<IFetchedRWAProject> = {}): IFetchedRWAProject {
	return { id: 'asset', ticker: 'ASSET', assetName: 'Asset', ...overrides }
}

describe('RWA asset table data', () => {
	it('distinguishes an unavailable active-mcap breakdown from measured zero', () => {
		expect(sumRwaMetricBreakdown(undefined)).toBeNull()
		expect(sumRwaMetricBreakdown(null)).toBeNull()
		expect(sumRwaMetricBreakdown({})).toBeNull()
		expect(sumRwaMetricBreakdown({ Ethereum: 0 })).toBe(0)
		expect(sumRwaMetricBreakdown({ Ethereum: 10, Base: 5 })).toBe(15)
	})

	it('preserves unavailable stock metrics while treating absent DeFi usage as zero', () => {
		expect(buildRWAAllChainsAssetTableRows([asset()])).toMatchObject([
			{ activeMcap: null, onChainMcap: null, defiActiveTvl: 0 }
		])
	})

	it('includes selected-chain assets based on source membership even when every value is zero', () => {
		const rows = buildRWAChainAssetTableRows(
			[
				asset({ activeMcap: { Ethereum: 0 }, onChainMcap: { Ethereum: 0 } }),
				asset({ id: 'other', ticker: 'OTHER', activeMcap: { Base: 10 } })
			],
			'Ethereum'
		)

		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({ name: 'Asset', activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0 })
	})

	it('uses canonical chain normalization for selected-chain totals', () => {
		const rows = buildRWAChainAssetTableRows(
			[asset({ activeMcap: { 'Arbitrum One': 12 }, defiActiveTvl: { 'Arbitrum One': { protocol: 3 } } })],
			'arbitrum-one'
		)

		expect(rows[0]).toMatchObject({ activeMcap: 12, onChainMcap: null, defiActiveTvl: 3 })
	})

	it('uses all-chain sums but selected-chain values for every displayed metric', () => {
		const input = [
			asset({
				onChainMcap: { Ethereum: 70, Base: 30 },
				activeMcap: { Ethereum: 40, Base: 20 },
				defiActiveTvl: { Ethereum: { A: 8, B: 2 }, Base: { A: 3 } }
			})
		]

		expect(buildRWAAllChainsAssetTableRows(input)[0]).toMatchObject({
			onChainMcap: 100,
			activeMcap: 60,
			defiActiveTvl: 13
		})
		expect(buildRWAChainAssetTableRows(input, 'Ethereum')[0]).toMatchObject({
			onChainMcap: 70,
			activeMcap: 40,
			defiActiveTvl: 10
		})
	})
})
