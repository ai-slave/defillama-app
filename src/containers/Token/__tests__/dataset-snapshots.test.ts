import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolLiquidityTokensResponse } from '~/api/types'
import type { TokenRiskBorrowCapacityResponse, TokenRiskBorrowCapacityTokenEntry } from '../api.types'

const mocks = vi.hoisted(() => ({
	fetchLiquidity: vi.fn(),
	fetchRisk: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn()
}))

vi.mock('~/api', () => ({ fetchLiquidityTokensDatasetFromNetwork: mocks.fetchLiquidity }))
vi.mock('~/containers/Token/api', () => ({ getTokenRiskBorrowCapacityFromNetwork: mocks.fetchRisk }))
vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))

import { buildLiquidityDomain } from '../server/dataset.liquidity.builder.server'
import { fetchLiquidityEntryByProtocolId } from '../server/dataset.liquidity.server'
import { buildRiskDomain } from '../server/dataset.risk.builder.server'
import { getIndexedTokenRiskBorrowCapacity } from '../server/dataset.risk.server'

const riskData: TokenRiskBorrowCapacityResponse = {
	methodologies: {
		asset: 'Asset',
		chain: 'Chain',
		protocol: 'Protocol',
		collateralMaxBorrowUsdGovernance: 'Governance max borrow',
		collateralMaxBorrowUsdLiquidity: 'Liquidity max borrow',
		collateralBorrowedDebtUsd: 'Borrowed debt',
		minBadDebtAtPriceZeroUsd: 'Min bad debt at zero'
	},
	timestamp: 1,
	hourlyTimestamp: 1,
	tokens: []
}

const liquidityData: ProtocolLiquidityTokensResponse = [
	{ id: 'aave', symbol: 'AAVE' },
	{ id: 'compound', symbol: 'COMP' }
]

beforeEach(() => {
	vi.clearAllMocks()
})

describe('token dataset snapshots', () => {
	it('hydrates the serialized risk index directly from the snapshot', async () => {
		const indexedEntry: TokenRiskBorrowCapacityTokenEntry = {
			asset: { symbol: 'USDC', address: '0x1', priceUsd: 1 },
			chain: 'ethereum',
			totals: {
				collateralMaxBorrowUsdGovernance: 100,
				collateralMaxBorrowUsdLiquidity: 90,
				collateralBorrowedDebtUsd: 50,
				minBadDebtAtPriceZeroUsd: 10
			},
			byProtocol: []
		}
		mocks.readJson.mockResolvedValue({ data: riskData, indexedTokens: { 'ethereum:0x1': [indexedEntry] } })

		const result = await getIndexedTokenRiskBorrowCapacity()

		expect(mocks.readJson).toHaveBeenCalledWith('risk', 'indexed.json')
		expect(result.data).toBe(riskData)
		expect(result.indexedTokens.get('ethereum:0x1')).toEqual([indexedEntry])
	})

	it('reads liquidity from the snapshot and skips disk access for an empty id', async () => {
		await expect(fetchLiquidityEntryByProtocolId('')).resolves.toBeNull()
		expect(mocks.readJson).not.toHaveBeenCalled()

		mocks.readJson.mockResolvedValue(liquidityData)
		await expect(fetchLiquidityEntryByProtocolId('compound')).resolves.toEqual({ id: 'compound', symbol: 'COMP' })
		expect(mocks.readJson).toHaveBeenCalledWith('liquidity', 'full.json')
	})

	it('writes risk and liquidity snapshots through the registered contracts', async () => {
		mocks.fetchRisk.mockResolvedValue(riskData)
		mocks.fetchLiquidity.mockResolvedValue(liquidityData)
		mocks.writeJson.mockResolvedValue(undefined)

		const writer = { writeJson: mocks.writeJson }
		await expect(buildRiskDomain(writer)).resolves.toBeUndefined()
		await expect(buildLiquidityDomain(writer)).resolves.toBeUndefined()

		expect(mocks.writeJson).toHaveBeenCalledWith('indexed.json', {
			data: riskData,
			indexedTokens: {}
		})
		expect(mocks.writeJson).toHaveBeenCalledWith('full.json', liquidityData)
	})
})
