import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))

import { V2_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import { fetchForkProtocolBreakdownChart, fetchForkProtocolChart } from '../api'

describe('Fork API routes', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset().mockResolvedValue([])
	})

	test('derives the protocol chart route from the canonical Fork name', async () => {
		await fetchForkProtocolChart({ protocol: 'Aave V3', key: 'vesting' })

		expect(fetchJson).toHaveBeenCalledWith(`${V2_SERVER_URL}/chart/fork/protocol/aave-v3?key=vesting`, {
			timeout: 30_000
		})
	})

	test('omits the key query for default TVL', async () => {
		await fetchForkProtocolBreakdownChart()

		expect(fetchJson).toHaveBeenCalledWith(`${V2_SERVER_URL}/chart/fork/protocol-breakdown`, {
			timeout: 30_000
		})
	})
})
