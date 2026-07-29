import { describe, expect, it } from 'vitest'
import { getChainAssetTableValues, hasChainAssetTableValue } from '../Table'

describe('ChainsByCategory bridged asset table values', () => {
	it('reads normalized category totals without object coercion', () => {
		const values = getChainAssetTableValues({
			total: { total: 100.5 },
			canonical: { total: 60.25 },
			native: { total: 10 },
			ownTokens: { total: 5 },
			thirdParty: { total: 30.25 }
		})

		expect(values).toEqual({ total: 100.5, canonical: 60.25, native: 10, ownTokens: 5, thirdParty: 30.25 })
	})

	it('keeps explicit zero totals visible', () => {
		const values = getChainAssetTableValues({
			total: { total: 0 },
			canonical: { total: 0 },
			thirdParty: { total: 0 }
		})

		expect(values).toEqual({ total: 0, canonical: 0, native: undefined, ownTokens: undefined, thirdParty: 0 })
		expect(hasChainAssetTableValue(values?.total)).toBe(true)
		expect(hasChainAssetTableValue(values?.canonical)).toBe(true)
		expect(hasChainAssetTableValue(values?.thirdParty)).toBe(true)
		expect(hasChainAssetTableValue(values?.native)).toBe(false)
	})
})
