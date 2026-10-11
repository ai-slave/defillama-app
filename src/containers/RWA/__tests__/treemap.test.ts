import { describe, expect, test } from 'vitest'
import { CHART_COLORS, chartColor, childColors } from '~/constants/colors'
import type { RWAAssetOverviewRow } from '../api.types'
import { buildCompleteRwaTreemapTreeData, buildRwaNestedTreemapTreeData, buildRwaTreemapTreeData } from '../treemap'

const baseAsset: RWAAssetOverviewRow = {
	id: 'alpha',
	kind: 'spot',
	detailHref: '/rwa/asset/alpha',
	assetName: 'Alpha',
	ticker: 'ALPHA',
	primaryChain: 'Ethereum',
	chain: ['Ethereum'],
	price: null,
	openInterest: null,
	volume24h: null,
	volume30d: null,
	assetGroup: 'Tokenized Treasuries',
	parentPlatform: null,
	category: ['Government Securities'],
	assetClass: ['Public Credit'],
	accessModel: 'Unknown',
	type: null,
	rwaClassification: null,
	issuer: null,
	redeemable: null,
	attestations: null,
	cexListed: null,
	kycForMintRedeem: null,
	kycAllowlistedWhitelistedToTransferHold: null,
	transferable: null,
	selfCustody: null,
	stablecoin: false,
	governance: false,
	trueRWA: true,
	suspicious: false,
	suspiciousReason: null,
	onChainMcap: {
		total: 100,
		breakdown: [['Ethereum', 100]]
	},
	activeMcap: {
		total: 100,
		breakdown: [['Ethereum', 100]]
	},
	defiActiveTvl: {
		total: 0,
		breakdown: []
	},
	defiActiveTvlByChain: {
		total: 0,
		breakdown: []
	},
	canonicalMarketId: 'alpha'
}

describe('buildRwaTreemapTreeData', () => {
	test('aggregates duplicate labels and keeps positive-value share output stable', () => {
		const tree = buildRwaTreemapTreeData(
			[
				{ name: 'Beta', value: 50 },
				{ name: 'Alpha', value: 100 },
				{ name: 'Beta', value: 25 },
				{ name: 'Zero', value: 0 },
				{ name: 'Negative', value: -5 }
			],
			'Asset Group'
		)

		expect(tree).toEqual([
			{
				name: 'Alpha',
				path: 'Asset Group/Alpha',
				value: [100, 57.14, 57.14],
				itemStyle: { color: CHART_COLORS[0] }
			},
			{
				name: 'Beta',
				path: 'Asset Group/Beta',
				value: [75, 42.86, 42.86],
				itemStyle: { color: CHART_COLORS[1] }
			}
		])
	})

	test('draws every flat group when there is no nested tree, and the nested tree when there is one', () => {
		const completePieData = [
			{ name: 'Visible', value: 100 },
			{ name: 'Outside visual limit', value: 25 }
		]
		const flat = buildCompleteRwaTreemapTreeData({ nestedTreeData: [], completePieData, breakdownLabel: 'Asset Group' })
		expect(flat.map((node) => node.name)).toEqual(['Visible', 'Outside visual limit'])

		const nested = buildRwaTreemapTreeData([{ name: 'Nested', value: 1 }], 'Asset Group')
		expect(
			buildCompleteRwaTreemapTreeData({ nestedTreeData: nested, completePieData, breakdownLabel: 'Asset Group' })
		).toBe(nested)
	})
})

describe('buildRwaNestedTreemapTreeData', () => {
	test('uses chain breakdown values directly while keeping zero rows out of the tree', () => {
		const tree = buildRwaNestedTreemapTreeData({
			assets: [
				{
					...baseAsset,
					onChainMcap: {
						total: 100,
						breakdown: [
							['Ethereum', 60],
							['Base', 40],
							['Arbitrum', 0]
						]
					}
				},
				{
					...baseAsset,
					id: 'beta',
					assetName: 'Beta',
					ticker: 'BETA',
					canonicalMarketId: 'beta',
					onChainMcap: {
						total: 50,
						breakdown: [['Ethereum', 50]]
					}
				},
				{
					...baseAsset,
					id: 'zero',
					assetName: 'Zero',
					ticker: 'ZERO',
					canonicalMarketId: 'zero',
					onChainMcap: {
						total: 0,
						breakdown: [['Ethereum', 0]]
					}
				}
			],
			metric: 'onChainMcap',
			rootLabel: 'Chain',
			parentGrouping: 'chain',
			childGrouping: 'assetName'
		})

		// Alpha is split across two chains, so its per-chain values differ from its total.
		expect(tree).toEqual([
			{
				name: 'Ethereum',
				path: 'Chain/Ethereum',
				value: [110, 73.33, 73.33],
				itemStyle: { color: CHART_COLORS[0] },
				children: [
					{
						name: 'Alpha',
						path: 'Chain/Ethereum/Alpha',
						value: [60, 54.55, 40],
						itemStyle: { color: CHART_COLORS[0] }
					},
					{
						name: 'Beta',
						path: 'Chain/Ethereum/Beta',
						value: [50, 45.45, 33.33],
						itemStyle: { color: childColors(chartColor(0), 2)[1] }
					}
				]
			},
			{
				name: 'Base',
				path: 'Chain/Base',
				value: [40, 26.67, 26.67],
				itemStyle: { color: CHART_COLORS[1] },
				children: [
					{
						name: 'Alpha',
						path: 'Chain/Base/Alpha',
						value: [40, 100, 26.67],
						itemStyle: { color: CHART_COLORS[1] }
					}
				]
			}
		])
	})

	test('subtracts bridge TVL from nested DeFi sizes when excluded', () => {
		const tree = buildRwaNestedTreemapTreeData({
			assets: [
				{
					...baseAsset,
					defiActiveTvl: { total: 10, breakdown: [['Aave', 10]] },
					defiActiveTvlByChain: { total: 10, breakdown: [['Ethereum', 10]] },
					bridgeTvl: 3,
					bridgeTvlByChain: { total: 3, breakdown: [['Ethereum', 3]] }
				}
			],
			metric: 'defiActiveTvl',
			rootLabel: 'Chain',
			parentGrouping: 'chain',
			childGrouping: 'assetName',
			includeBridgeTvl: false
		})

		expect(tree[0]?.value[0]).toBe(7)
		expect(tree[0]?.children?.[0]?.value[0]).toBe(7)
	})
})
