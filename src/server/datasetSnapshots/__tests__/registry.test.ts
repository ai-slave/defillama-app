import { describe, expect, test } from 'vitest'
import { DATASET_SNAPSHOT_REGISTRY } from '../registry.server'

describe('dataset snapshot registry', () => {
	test('refreshes Yields every 10 minutes while other datasets remain hourly', () => {
		expect(DATASET_SNAPSHOT_REGISTRY.yields.maxAgeMs).toBe(10 * 60 * 1000)

		for (const [domain, registration] of Object.entries(DATASET_SNAPSHOT_REGISTRY)) {
			if (domain === 'yields') continue
			expect(registration.maxAgeMs).toBe(60 * 60 * 1000)
		}
	})
})
