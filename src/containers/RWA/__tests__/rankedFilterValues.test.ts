import { describe, expect, it } from 'vitest'
import { getRankedRwaFilterValues } from '../rankedFilterValues'

describe('getRankedRwaFilterValues', () => {
	it('derives every filter key list in ranked option order without mutation', () => {
		const options = {
			typeOptions: [
				{ key: 'Fund', name: 'Fund' },
				{ key: 'Bond', name: 'Bond', help: 'Bond help' }
			],
			categoriesOptions: [{ key: 'Treasuries', name: 'Treasuries' }],
			assetClassOptions: [{ key: 'Debt', name: 'Debt' }],
			rwaClassificationOptions: [{ key: 'RWA', name: 'RWA' }],
			accessModelOptions: [{ key: 'Permissioned', name: 'Permissioned' }]
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
