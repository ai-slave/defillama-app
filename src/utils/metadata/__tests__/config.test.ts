import { afterEach, describe, expect, test, vi } from 'vitest'
import { shouldStartMetadataRuntimeRefreshLoop } from '../config'

describe('metadata cache config', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	test('disables the runtime refresh loop in tests and builds', () => {
		vi.stubEnv('NODE_ENV', 'production')
		expect(shouldStartMetadataRuntimeRefreshLoop()).toBe(true)

		vi.stubEnv('NODE_ENV', 'test')
		expect(shouldStartMetadataRuntimeRefreshLoop()).toBe(false)

		vi.stubEnv('NODE_ENV', 'production')
		vi.stubEnv('NEXT_PHASE', 'phase-production-build')
		expect(shouldStartMetadataRuntimeRefreshLoop()).toBe(false)

		vi.stubEnv('NEXT_PHASE', '')
		vi.stubEnv('npm_lifecycle_event', 'build')
		expect(shouldStartMetadataRuntimeRefreshLoop()).toBe(false)
	})
})
