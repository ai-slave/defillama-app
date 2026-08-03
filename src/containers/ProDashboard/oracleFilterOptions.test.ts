import { describe, expect, it } from 'vitest'
import type { OracleNamesByProtocol } from '~/containers/Oracles/membership'
import { buildOracleFilterOptions } from './oracleFilterOptions'
import type { Protocol } from './types'

const protocol = (id: string, name: string, tvl: number, parentProtocol: string | null = null): Protocol => ({
	id,
	name,
	slug: id,
	tvl,
	chains: [],
	parentProtocol
})

describe('oracle filter options', () => {
	it('ranks parent ecosystems once while including child oracle integrations', () => {
		const protocols = [
			protocol('parent', 'Parent', 100),
			protocol('child', 'Child', 60, 'parent'),
			protocol('solo', 'Solo', 80)
		]
		const oracleNames: OracleNamesByProtocol = new Map([
			['Child', ['Pyth']],
			['Solo', ['Chainlink']]
		])

		expect(buildOracleFilterOptions(protocols, oracleNames)).toEqual([
			{ value: 'Pyth', label: 'Pyth' },
			{ value: 'Chainlink', label: 'Chainlink' }
		])
	})
})
