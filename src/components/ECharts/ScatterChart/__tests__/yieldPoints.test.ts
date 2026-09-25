import { expect, test } from 'vitest'
import { groupYieldScatterPoints } from '../yieldPoints'

test('groups interleaved yield pools by project in first-seen order and skips pools without risk and return', () => {
	expect(
		groupYieldScatterPoints([
			{ projectName: 'B', sigma: 1, mu: 2, symbol: 'B1' },
			{ projectName: 'A', sigma: 3, mu: 4, symbol: 'A1', pool: 'pool-a', tvlUsd: 100, apy: 4, chain: 'Ethereum' },
			{ projectName: 'B', sigma: 5, mu: 6, symbol: 'B2' },
			{ projectName: 'C', sigma: null, mu: 6, symbol: 'C1' },
			{ projectName: 'D', sigma: 7, mu: null, symbol: 'D1' }
		])
	).toEqual(
		new Map([
			[
				'B',
				[
					[1, 2, undefined, 'B1', undefined, undefined, undefined, undefined],
					[5, 6, undefined, 'B2', undefined, undefined, undefined, undefined]
				]
			],
			['A', [[3, 4, undefined, 'A1', 'pool-a', 100, 4, 'Ethereum']]]
		])
	)
})
