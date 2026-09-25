import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchForkProtocolChart } from '../api'
const http = installFixtureFetch()
describe('Fork API routes', () => {
	test('fetches the canonical protocol chart with its selected metric', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/fork/protocol/aave-v3?key=vesting`]: [
				[1, 25],
				[2, 30]
			]
		})
		await expect(fetchForkProtocolChart({ protocol: 'Aave V3', key: 'vesting' })).resolves.toEqual([
			[1, 25],
			[2, 30]
		])
	})
})
