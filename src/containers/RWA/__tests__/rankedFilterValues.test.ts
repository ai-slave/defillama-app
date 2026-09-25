import { describe, expect, test } from 'vitest'
import { getRankedRwaFilterValues } from '../rankedFilterValues'

describe('getRankedRwaFilterValues', () => {
	test('derives every filter key list from its own options list, in ranked order', () => {
		expect(
			getRankedRwaFilterValues({
				typeOptions: [
					{ key: 'Fund', name: 'Fund' },
					{ key: 'Bond', name: 'Bond', help: 'Bond help' }
				],
				categoriesOptions: [{ key: 'Treasuries', name: 'Treasuries' }],
				assetClassOptions: [{ key: 'Debt', name: 'Debt' }],
				rwaClassificationOptions: [{ key: 'RWA', name: 'RWA' }],
				accessModelOptions: [{ key: 'Permissioned', name: 'Permissioned' }]
			})
		).toEqual({
			types: ['Fund', 'Bond'],
			categories: ['Treasuries'],
			assetClasses: ['Debt'],
			rwaClassifications: ['RWA'],
			accessModels: ['Permissioned']
		})
	})
})
