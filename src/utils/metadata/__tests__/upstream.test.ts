import { beforeEach, describe, expect, test, vi } from 'vitest'

describe('metadata upstream base selection', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.unstubAllEnvs()
	})

	test('uses public upstreams without an API key', async () => {
		vi.stubEnv('API_KEY', '')
		const { getMetadataUpstreamBase } = await import('../upstream')

		expect(getMetadataUpstreamBase('core')).toBe('https://api.llama.fi')
		expect(getMetadataUpstreamBase('rwa')).toBe('https://api.llama.fi/rwa')
		expect(getMetadataUpstreamBase('rwa-perps')).toBe('https://api.llama.fi/rwa-perps')
		expect(getMetadataUpstreamBase('bridges')).toBe('https://bridges.llama.fi')
		expect(getMetadataUpstreamBase('datasets')).toBe('https://defillama-datasets.llama.fi')
	})

	test('uses pro upstreams with an API key', async () => {
		vi.stubEnv('API_KEY', 'secret-key')
		const { getMetadataUpstreamBase } = await import('../upstream')

		expect(getMetadataUpstreamBase('core')).toBe('https://pro-api.llama.fi/secret-key/api')
		expect(getMetadataUpstreamBase('rwa')).toBe('https://pro-api.llama.fi/secret-key/rwa')
		expect(getMetadataUpstreamBase('rwa-perps')).toBe('https://pro-api.llama.fi/secret-key/rwa-perps')
		expect(getMetadataUpstreamBase('bridges')).toBe('https://pro-api.llama.fi/secret-key/bridges')
		expect(getMetadataUpstreamBase('datasets')).toBe('https://pro-api.llama.fi/secret-key/datasets')
	})

	test('uses direct URL overrides before pro upstreams', async () => {
		vi.stubEnv('API_KEY', 'secret-key')
		vi.stubEnv('BRIDGES_SERVER_URL', 'https://bridges.example.com/')
		vi.stubEnv('DATASETS_SERVER_URL', 'https://datasets.example.com/')
		vi.stubEnv('RWA_PERPS_SERVER_URL', 'https://rwa-perps.example.com/')
		vi.stubEnv('RWA_SERVER_URL', 'https://rwa.example.com/')
		vi.stubEnv('SERVER_URL', 'https://core.example.com/api/')
		const { getMetadataUpstreamBase } = await import('../upstream')

		expect(getMetadataUpstreamBase('core')).toBe('https://core.example.com/api')
		expect(getMetadataUpstreamBase('rwa')).toBe('https://rwa.example.com')
		expect(getMetadataUpstreamBase('rwa-perps')).toBe('https://rwa-perps.example.com')
		expect(getMetadataUpstreamBase('bridges')).toBe('https://bridges.example.com')
		expect(getMetadataUpstreamBase('datasets')).toBe('https://datasets.example.com')
	})
})
