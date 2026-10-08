import { describe, expect, test } from 'vitest'
import { getRwaAssetGroupHref } from '../classificationHrefs'

describe('getRwaAssetGroupHref', () => {
	test('points asset rows at the Assets tree and perps rows at the Perps tree', () => {
		expect(getRwaAssetGroupHref('Private Equity & Venture', 'spot')).toBe('/rwa/asset-group/private-equity-venture')
		expect(getRwaAssetGroupHref('Equity Indices', 'perps')).toBe('/rwa/perps/asset-group/equity-indices')
	})

	test('leaves Unknown unlinked on perps rows, where no page serves it', () => {
		expect(getRwaAssetGroupHref('Unknown', 'spot')).toBe('/rwa/asset-group/unknown')
		expect(getRwaAssetGroupHref('Unknown', 'perps')).toBeNull()
	})
})
