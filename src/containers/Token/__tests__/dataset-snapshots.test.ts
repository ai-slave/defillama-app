import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TokenRiskBorrowCapacityResponse, TokenRiskBorrowCapacityTokenEntry } from '../api.types'

const mocks = vi.hoisted(() => ({
	fetchRisk: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn()
}))

vi.mock('~/containers/Token/api', () => ({ getTokenRiskBorrowCapacityFromNetwork: mocks.fetchRisk }))
vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))

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

beforeEach(() => {
	vi.clearAllMocks()
})

describe('token risk dataset snapshot', () => {
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

	it('writes the risk snapshot through the registered contract', async () => {
		mocks.fetchRisk.mockResolvedValue(riskData)
		mocks.writeJson.mockResolvedValue(undefined)

		const writer = { writeJson: mocks.writeJson }
		await expect(buildRiskDomain(writer)).resolves.toBeUndefined()

		expect(mocks.writeJson).toHaveBeenCalledWith('indexed.json', {
			data: riskData,
			indexedTokens: {}
		})
	})
})
