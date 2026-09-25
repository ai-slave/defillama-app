import { afterEach } from 'vitest'
import metadataCache from '~/utils/metadata'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

/**
 * Seeds the real, mutable metadata cache instead of mocking `~/utils/metadata`.
 * Call once at the top of a test file, then `seed()` inside each test. Every
 * seeded field is restored after the test.
 */
export function installMetadataSeeder() {
	const saved = new Map<keyof MetadataCache, unknown>()

	afterEach(() => {
		for (const [key, value] of saved) (metadataCache as Record<string, unknown>)[key] = value
		saved.clear()
	})

	return {
		seed(partial: Partial<MetadataCache>) {
			for (const key in partial) {
				const field = key as keyof MetadataCache
				if (!saved.has(field)) saved.set(field, metadataCache[field])
			}
			Object.assign(metadataCache, partial)
		}
	}
}
