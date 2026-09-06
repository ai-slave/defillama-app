import { describe, expect, test } from 'vitest'
import {
	getDeprecatedChainNames,
	getDeprecatedChainsByName,
	isDeprecatedChain
} from '~/utils/metadata/deprecatedChains'
import type { IChainMetadata } from '~/utils/metadata/types'

const chainMetadata: Record<string, IChainMetadata> = {
	ethereum: { name: 'Ethereum', id: 'ethereum' },
	'zksync-lite': { name: 'ZKsync Lite', id: 'zksync', deprecated: true },
	'sx-network': { name: 'SX Network', id: 'sx', deprecated: true }
}

describe('deprecated chain metadata helpers', () => {
	test('checks deprecated state by display name', () => {
		expect(isDeprecatedChain(chainMetadata, 'ZKsync Lite')).toBe(true)
		expect(isDeprecatedChain(chainMetadata, 'Ethereum')).toBe(false)
	})

	test('builds deprecated lookup records from metadata and selected chain names', () => {
		expect(getDeprecatedChainNames(chainMetadata)).toEqual({
			'ZKsync Lite': true,
			'SX Network': true
		})
		expect(getDeprecatedChainsByName(chainMetadata, ['Ethereum', 'SX Network'])).toEqual({
			'SX Network': true
		})
	})
})
