import { expect, test } from 'vitest'
import { readOrBuild } from '../server/marketData.server'

test('returns the last good snapshot as stale when rebuilding fails', async () => {
	const lastGood = { key: 'technology', version: 'old', generatedAt: 1, data: { value: 42 } }
	const result = await readOrBuild({
		cacheKey: 'technology',
		store: {
			readCurrent: async () => null,
			readLastGood: async () => lastGood,
			publish: async () => undefined
		},
		build: async () => {
			throw new Error('upstream unavailable')
		}
	})

	expect(result).toEqual({ snapshot: lastGood, stale: true })
})
