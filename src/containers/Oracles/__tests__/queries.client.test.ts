import { describe, expect, test } from 'vitest'
import { buildOracleProtocolChainExtraSeries } from '../queries.client'

describe('buildOracleProtocolChainExtraSeries', () => {
	test('keeps only actual selected-chain points so other chains do not create coverage', () => {
		expect(
			buildOracleProtocolChainExtraSeries({
				chain: 'BSC',
				chainBreakdown: [
					{ timestamp: 1, BSC: 10 },
					{ timestamp: 2, Ethereum: 20 },
					{ timestamp: 3, BSC: 0 }
				]
			})
		).toEqual([
			[1, 10],
			[3, 0]
		])
	})
})
