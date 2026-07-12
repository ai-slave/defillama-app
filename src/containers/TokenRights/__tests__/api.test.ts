import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/constants', () => ({ SERVER_URL: 'https://private-upstream.example/credential' }))
vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

import { fetchTokenRightsDataFromNetwork } from '../api'

afterEach(() => {
	mocks.fetchJson.mockReset()
	vi.restoreAllMocks()
})

describe('token rights network errors', () => {
	it('does not include the upstream URL in logs', async () => {
		const error = new Error('network down')
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		mocks.fetchJson.mockRejectedValue(error)

		await expect(fetchTokenRightsDataFromNetwork()).resolves.toEqual([])

		expect(consoleError).toHaveBeenCalledWith('[token-rights] upstream request failed')
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain('private-upstream')
	})
})
