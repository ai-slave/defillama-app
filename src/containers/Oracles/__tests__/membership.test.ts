import { describe, expect, it } from 'vitest'
import { buildOracleNamesByProtocol } from '../membership'

describe('buildOracleNamesByProtocol', () => {
	it('inverts the authoritative metric membership without inferring fallback oracles', () => {
		const result = buildOracleNamesByProtocol({
			Atlas: ['Aster Perps'],
			Chainlink: ['Measured Protocol'],
			Pyth: ['Measured Protocol']
		})

		expect(result).toEqual(
			new Map([
				['Aster Perps', ['Atlas']],
				['Measured Protocol', ['Chainlink', 'Pyth']]
			])
		)
	})
})
