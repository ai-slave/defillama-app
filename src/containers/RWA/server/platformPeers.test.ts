import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchRWAStats: vi.fn()
}))

vi.mock('~/containers/RWA/api', () => ({ fetchRWAStats: mocks.fetchRWAStats }))
vi.mock('~/utils/metadata', () => ({
	default: { rwaPlatformsIndex: { generatedAt: 1, byPid: {}, platforms: {} } }
}))

import { rwaPlatformPeers } from './platformPeers'

describe('RWA platform peers API', () => {
	beforeEach(() => {
		mocks.fetchRWAStats.mockResolvedValue({ byPlatform: {} })
	})

	test('joins the platform index and stats into a client-safe peer response', async () => {
		const result = await rwaPlatformPeers.handle({
			method: 'GET',
			url: '/api/public/rwa/platform-peers',
			query: {},
			headers: {}
		})

		expect(result.status).toBe(200)
		expect('serializedJson' in result ? JSON.parse(result.serializedJson) : result.body).toEqual([])
		expect(mocks.fetchRWAStats).toHaveBeenCalledOnce()
	})
})
