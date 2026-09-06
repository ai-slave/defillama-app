import { describe, expect, test } from 'vitest'
import { buildYieldsFilterOptions, type YieldsFilterSourceRow } from './options'

const row = ({
	project = '',
	projectslug = '',
	tvl = null,
	tokenSymbols = [],
	category = null
}: {
	project?: string
	projectslug?: string
	tvl?: number | null
	tokenSymbols?: Array<string>
	category?: string | null
}): YieldsFilterSourceRow => ({ project, projectslug, tvl, tokenSymbols, category })

describe('buildYieldsFilterOptions', () => {
	test('returns empty option collections for empty data', () => {
		expect(buildYieldsFilterOptions([])).toEqual({
			availableTokens: [],
			availableProtocols: [],
			availableCategories: []
		})
	})

	test('builds all option collections in one pass without mutating rows', () => {
		const input = [
			row({ project: 'Aave', projectslug: 'aave', tvl: 10, tokenSymbols: ['USDC', 'USDC'], category: 'Lending' }),
			row({ project: 'Aave V3', projectslug: 'aave', tvl: null, tokenSymbols: ['DAI'], category: 'Lending' }),
			row({ project: 'Curve', projectslug: '', tvl: 20, tokenSymbols: ['DAI'], category: 'Dexes' }),
			row({ project: '', projectslug: '   ', tvl: 100, tokenSymbols: ['IGNORED'], category: '' })
		]
		const snapshot = structuredClone(input)

		expect(buildYieldsFilterOptions(input)).toEqual({
			availableTokens: ['IGNORED', 'USDC', 'DAI'],
			availableProtocols: [
				{ value: 'Curve', label: 'Curve' },
				{ value: 'aave', label: 'Aave' }
			],
			availableCategories: ['Dexes', 'Lending']
		})
		expect(input).toEqual(snapshot)
	})

	test('preserves first encounter for tied token TVL and label order for tied protocols', () => {
		const result = buildYieldsFilterOptions([
			row({ project: 'Zulu', projectslug: 'zulu', tvl: 10, tokenSymbols: ['FIRST'], category: 'Yield' }),
			row({ project: 'Alpha', projectslug: 'alpha', tvl: 10, tokenSymbols: ['SECOND'], category: 'Yield' }),
			row({ project: 'Zero', projectslug: 'zero', tvl: 0, tokenSymbols: ['ZERO'], category: null })
		])

		expect(result.availableTokens).toEqual(['FIRST', 'SECOND', 'ZERO'])
		expect(result.availableProtocols).toEqual([
			{ value: 'alpha', label: 'Alpha' },
			{ value: 'zulu', label: 'Zulu' },
			{ value: 'zero', label: 'Zero' }
		])
		expect(result.availableCategories).toEqual(['Yield'])
	})
})
