import { describe, expect, test } from 'vitest'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { keepKnownProtocolSlug } from '../protocolLink'

const metadataCache = {
	protocolRouteIdBySlug: { ostium: 'parent#ostium' },
	cexRouteIdBySlug: { binance: 'binance-id' },
	protocolMetadata: {
		'parent#ostium': { name: 'ostium', displayName: 'Ostium' },
		'binance-id': { name: 'Binance CEX' }
	},
	cexMetadataBySlug: {}
} as unknown as MetadataCache

describe('keepKnownProtocolSlug', () => {
	test('keeps a slug the protocol page resolves, a protocol or a CEX', () => {
		expect(keepKnownProtocolSlug({ protocolSlug: 'ostium' }, metadataCache).protocolSlug).toBe('ostium')
		expect(keepKnownProtocolSlug({ protocolSlug: 'binance' }, metadataCache).protocolSlug).toBe('binance')
	})

	test('drops a slug with no protocol page, so About draws no dead link', () => {
		expect(keepKnownProtocolSlug({ protocolSlug: 'trade-xyz' }, metadataCache).protocolSlug).toBeNull()
		expect(keepKnownProtocolSlug({ protocolSlug: null }, metadataCache).protocolSlug).toBeNull()
	})
})
