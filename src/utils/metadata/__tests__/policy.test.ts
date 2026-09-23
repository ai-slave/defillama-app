import { describe, expect, test } from 'vitest'
import { DIRECT_URL_ENV_NAMES } from '../../directApi'
import { shouldSkipMetadataRefresh, shouldWriteMetadataStubsOnFailure } from '../policy'

describe('metadata stub policy', () => {
	test('skips unconfigured local development but allows keyed and production refreshes', () => {
		expect(shouldSkipMetadataRefresh({ NODE_ENV: 'development', API_KEY: '' })).toBe(true)
		expect(shouldSkipMetadataRefresh({ NODE_ENV: 'development', API_KEY: 'key' })).toBe(false)
		expect(shouldSkipMetadataRefresh({ NODE_ENV: 'production', API_KEY: '' })).toBe(false)
	})

	test.each(DIRECT_URL_ENV_NAMES)('allows refresh without an API key when %s is configured', (name) => {
		expect(
			shouldSkipMetadataRefresh({ NODE_ENV: 'development', API_KEY: '', [name]: ' https://upstream.example.com/ ' })
		).toBe(false)
		expect(shouldSkipMetadataRefresh({ NODE_ENV: 'development', API_KEY: '', [name]: '   ' })).toBe(true)
	})

	test('allows stub writes only in development', () => {
		expect(shouldWriteMetadataStubsOnFailure({ CI: 'true', NODE_ENV: 'production' })).toBe(false)
		expect(shouldWriteMetadataStubsOnFailure({ CI: 'false', NODE_ENV: 'production' })).toBe(false)
		expect(shouldWriteMetadataStubsOnFailure({ CI: '1', NODE_ENV: 'production' })).toBe(false)
		expect(shouldWriteMetadataStubsOnFailure({ NODE_ENV: 'development' })).toBe(true)
		expect(shouldWriteMetadataStubsOnFailure({ NODE_ENV: 'production' })).toBe(false)
	})
})
