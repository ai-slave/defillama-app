import { expect, test } from 'vitest'
import { RISK_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installSnapshotDirectory } from '~/utils/testing/snapshotDirectory'
import type { TokenRiskBorrowCapacityResponse, TokenRiskBorrowCapacityTokenEntry } from '../api.types'

const http = installFixtureFetch()
installSnapshotDirectory('token-risk-test')

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
test.each([{ tokens: [] }, { tokens: [indexedEntry] }])(
	'publishes and hydrates the risk index for $tokens',
	async ({ tokens }) => {
		const data = { ...riskData, tokens }
		http.serve({ [`${RISK_SERVER_URL}/get-borrow-capacity-by-asset`]: data })
		const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
		const { buildRiskDomain } = await import('../server/dataset.risk.builder.server')
		await fileDatasetSnapshotStore.publish('risk', buildRiskDomain)
		const { getIndexedTokenRiskBorrowCapacity } = await import('../server/dataset.risk.server')
		const result = await getIndexedTokenRiskBorrowCapacity()
		expect(result.data).toEqual(data)
		expect([...result.indexedTokens]).toEqual(tokens.length > 0 ? [['ethereum:0x1', [indexedEntry]]] : [])
		// One upstream fetch at publish: the read comes from the snapshot.
		expect(http.requests).toHaveLength(1)
	}
)
