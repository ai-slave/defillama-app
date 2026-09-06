import { createTable, flexRender, getCoreRowModel } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { prepareTableCsv } from '~/components/Table/utils'
import type { IRWAAssetsOverview, IRWAFlowSummaryResponse } from '../api.types'
import {
	createAssetTableRows,
	createRWAAssetColumns,
	getActiveMetricValue,
	getDefiMetricValue,
	getDefiUtilization,
	getMetricColumnHeaders,
	getOnChainMetricValue
} from '../AssetsTable'

function createSpotAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }> {
	return {
		id: '1',
		kind: 'spot',
		detailHref: '/rwa/asset/ondo%2Fusdy',
		canonicalMarketId: 'ondo/usdy',
		ticker: 'USDY',
		assetName: 'Ondo USDY',
		primaryChain: null,
		chain: null,
		price: 1,
		openInterest: null,
		volume24h: null,
		volume30d: null,
		assetGroup: 'Treasuries',
		parentPlatform: 'Ondo',
		category: ['Treasuries'],
		assetClass: ['Bonds'],
		accessModel: 'Permissioned',
		type: 'Bond Fund',
		rwaClassification: 'RWA',
		issuer: 'Ondo',
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: false,
		governance: false,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: { total: 200, breakdown: [] },
		activeMcap: { total: 100, breakdown: [] },
		defiActiveTvl: { total: 25, breakdown: [] },
		defiActiveTvlByChain: { total: 25, breakdown: [['Ethereum', 25]] },
		...overrides
	}
}

function createPerpsAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }> {
	return {
		id: 'perps-1',
		kind: 'perps',
		venueType: 'DEX',
		detailHref: '/rwa/perps/contract/xyz%3Ausdy',
		contract: 'xyz:USDY',
		ticker: 'xyz:USDY',
		assetName: 'USDY Perp',
		primaryChain: null,
		chain: null,
		price: 1,
		openInterest: 333,
		volume24h: 111,
		volume30d: 222,
		assetGroup: 'Treasuries',
		parentPlatform: 'XYZ',
		category: ['Treasuries'],
		assetClass: ['Bond Perp'],
		accessModel: 'Permissionless',
		type: 'Perp',
		rwaClassification: 'RWA',
		issuer: 'XYZ',
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: null,
		governance: null,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: null,
		...overrides
	}
}

function createFlowSummary(): IRWAFlowSummaryResponse {
	const emptyGroups = { assetGroup: {}, platform: {}, category: {}, chain: {} }

	return {
		generatedAt: 1,
		windows: {
			'7d': {
				...emptyGroups,
				asset: {
					'ondo/usdy': {
						flow: 0,
						mcap: 100,
						intensityPct: 0,
						coverage: 1,
						byChain: { Ethereum: { status: 'measured', flow: 0, coverage: 1 } }
					}
				}
			},
			'30d': {
				...emptyGroups,
				asset: {
					'ondo/usdy': {
						flow: -50,
						mcap: 100,
						intensityPct: -50,
						coverage: 1,
						byChain: { Ethereum: { status: 'measured', flow: -50, coverage: 1 } }
					}
				}
			}
		}
	}
}

describe('RWAAssetsTable', () => {
	test.each(['DEX', 'CEX'] as const)(
		'shows and exports N/A for %s perp attestations regardless of the stored flag',
		(venueType) => {
			for (const attestations of [true, false, null]) {
				const asset = createPerpsAsset({ venueType, attestations })
				const result = renderAttestations(asset)
				expect(result.markup).toBe('<span class="text-tertiary">N/A</span>')
				expect(result.csv).toBe('N/A')
				expect(result.value).toBeUndefined()
			}
		}
	)

	test.each([
		[true, 'Yes', true],
		[false, 'No', false],
		[null, '', '']
	] as const)('preserves spot attestations for %s', (attestations, label, csv) => {
		const result = renderAttestations(createSpotAsset({ attestations }))
		expect(result.markup).toContain(`>${label}</span>`)
		expect(result.csv).toBe(csv)
	})

	test('keeps the original metric headers when the perps toggle is off', () => {
		expect(getMetricColumnHeaders(false)).toEqual({
			active: 'Active Marketcap',
			onChain: 'Onchain Marketcap',
			defi: 'DeFi Active TVL'
		})
	})

	test('uses OI in the active mcap column when the perps toggle is on', () => {
		expect(getMetricColumnHeaders(true)).toEqual({
			active: 'Active Mcap or OI',
			onChain: 'Onchain Marketcap',
			defi: 'DeFi Active TVL'
		})

		expect(getActiveMetricValue(createSpotAsset())).toBe(100)
		expect(getOnChainMetricValue(createSpotAsset())).toBe(200)
		expect(getDefiMetricValue(createSpotAsset())).toBe(25)
		expect(getDefiMetricValue(createSpotAsset({ bridgeTvl: 10 }), false)).toBe(15)
		expect(getActiveMetricValue(createPerpsAsset())).toBe(333)
		expect(getOnChainMetricValue(createPerpsAsset())).toBeNull()
		expect(getDefiMetricValue(createPerpsAsset())).toBeNull()
	})

	test('materializes loaded flow summaries without dropping measured zero', () => {
		const assets = [createSpotAsset()]
		const initialRows = createAssetTableRows(assets, undefined)
		const loadedRows = createAssetTableRows(assets, createFlowSummary())
		const initialRow = initialRows[0]
		const loadedRow = loadedRows[0]

		if (!initialRow || !loadedRow) throw new Error('Expected one table row for the fixture asset')

		expect(initialRow.flowSummaries['7d']).toBeUndefined()
		expect(loadedRow.flowSummaries['7d']?.flow).toBe(0)
		expect(loadedRow.flowSummaries['30d']?.flow).toBe(-50)
	})

	test('calculates DeFi utilization from nullable typed metrics without coercion', () => {
		expect(getDefiUtilization(createSpotAsset())).toBe(25)
		expect(getDefiUtilization(createSpotAsset({ bridgeTvl: 10 }), false)).toBe(15)
		expect(getDefiUtilization(createSpotAsset({ defiActiveTvl: { total: 0, breakdown: [] } }))).toBe(0)
		expect(getDefiUtilization(createSpotAsset({ activeMcap: null }))).toBeUndefined()
		expect(getDefiUtilization(createSpotAsset({ activeMcap: { total: 0, breakdown: [] } }))).toBeUndefined()
		expect(getDefiUtilization(createSpotAsset({ activeMcap: { total: -100, breakdown: [] } }))).toBe(-25)
	})
})

function renderAttestations(asset: IRWAAssetsOverview['assets'][number]) {
	const table = createTable({
		data: createAssetTableRows([asset], undefined),
		columns: createRWAAssetColumns(true, false, false),
		getCoreRowModel: getCoreRowModel(),
		state: {},
		onStateChange: () => {},
		renderFallbackValue: null
	})
	const cell = table
		.getRowModel()
		.rows[0].getAllCells()
		.find((cell) => cell.column.id === 'attestations')!
	const csv = prepareTableCsv({ instance: table, filename: 'rwa-assets' }).rows
	return {
		markup: renderToStaticMarkup(flexRender(cell.column.columnDef.cell, cell.getContext())),
		value: cell.getValue(),
		csv: csv[1][csv[0].indexOf('Attestations')]
	}
}
