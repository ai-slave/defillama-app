import { findOptimizerPools, formatOptimizerPool } from '~/containers/Yields/domain/strategyFilters'
import { matchesYieldPoolToken } from '~/containers/Yields/domain/tokenFilter'
import type { LendBorrowData } from '~/containers/Yields/types'
import type { TokenBorrowRoutesResponse } from './tokenBorrowRoutes.types'

type LendBorrowPools = LendBorrowData['props']['pools']

export function buildTokenBorrowRoutesData(token: string, pools: LendBorrowPools): TokenBorrowRoutesResponse {
	const normalizedToken = token.trim().toUpperCase()
	const lendingPools = pools.filter((pool) => pool.category !== 'CDP' && !pool.mintedCoin)
	const cdpPools = pools
		.filter((pool) => (pool.category === 'CDP' && pool.mintedCoin) || (pool.category === 'Lending' && pool.mintedCoin))
		.map((pool) => ({ ...pool, chains: [pool.chain], borrow: { ...pool, symbol: pool.mintedCoin.toUpperCase() } }))

	const borrowAsCollateral = findOptimizerPools({
		pools: lendingPools,
		tokenToLend: normalizedToken,
		tokenToBorrow: undefined,
		cdpRoutes: cdpPools
	})
		.filter(
			(pool) =>
				matchesYieldPoolToken(pool.symbol, normalizedToken) &&
				!matchesYieldPoolToken(pool.borrow?.symbol ?? '', normalizedToken)
		)
		.map((pool) => formatOptimizerPool({ pool, customLTV: null }))
		.sort((a, b) => (b.totalReward ?? Number.NEGATIVE_INFINITY) - (a.totalReward ?? Number.NEGATIVE_INFINITY))

	const borrowAsDebt = findOptimizerPools({
		pools: lendingPools,
		tokenToLend: undefined,
		tokenToBorrow: normalizedToken,
		cdpRoutes: cdpPools
	})
		.filter((pool) => matchesYieldPoolToken(pool.borrow?.symbol ?? '', normalizedToken))
		.map((pool) => formatOptimizerPool({ pool, customLTV: null }))
		.sort((a, b) => (b.totalReward ?? Number.NEGATIVE_INFINITY) - (a.totalReward ?? Number.NEGATIVE_INFINITY))

	return { borrowAsCollateral, borrowAsDebt }
}
