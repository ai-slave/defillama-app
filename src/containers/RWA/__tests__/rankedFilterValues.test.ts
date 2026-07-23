import { describe, expect, it } from 'vitest'
import { getRankedRwaFilterValues } from '../rankedFilterValues'

describe('getRankedRwaFilterValues', () => {
	it('derives every filter key list in ranked option order without mutation', () => {
		const options = {
			typeOptions: [
				{ key: 'Fund', name: 'Fund', help: null },
				{ key: 'Bond', name: 'Bond', help: 'Bond help' }
			],
			categoriesOptions: [{ key: 'Treasuries', name: 'Treasuries', help: null }],
			assetClassOptions: [{ key: 'Debt', name: 'Debt', help: null }],
			rwaClassificationOptions: [{ key: 'RWA', name: 'RWA', help: null }],
			accessModelOptions: [{ key: 'Permissioned', name: 'Permissioned', help: null }]
		}
		const original = structuredClone(options)

		expect(getRankedRwaFilterValues(options)).toEqual({
			types: ['Fund', 'Bond'],
			categories: ['Treasuries'],
			assetClasses: ['Debt'],
			rwaClassifications: ['RWA'],
			accessModels: ['Permissioned']
		})
		expect(options).toEqual(original)
	})
})
