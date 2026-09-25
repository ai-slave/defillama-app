import { beforeEach, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { incomeStatement } from '../server/api'

const http = installFixtureFetch()
const metadata = installMetadataSeeder()
const UPSTREAM = `${V2_SERVER_URL}/metrics/financial-statement/protocol/serialized-cache-protocol`

beforeEach(() => {
	metadata.seed({
		protocolMetadata: {
			'serialized-cache-protocol': {
				name: 'serialized-cache-protocol',
				displayName: 'Serialized Cache Protocol',
				fees: true,
				revenue: true
			}
		}
	})
	http.serve({
		[UPSTREAM]: {
			aggregates: {
				monthly: { '2026-01': { Revenue: { value: 42, 'by-label': { Swap: 40 } } } },
				quarterly: {},
				yearly: {}
			}
		}
	})
})

function request(version?: string) {
	const query: Record<string, string> = { protocol: 'Serialized Cache Protocol' }
	if (version) query.version = version
	return {
		method: 'GET',
		url: `/api/public/income-statement?protocol=Serialized%20Cache%20Protocol${version ? `&version=${version}` : ''}`,
		query,
		headers: {}
	}
}

test('serves v2 periods with nested values and legacy periods with flattened values from one upstream fetch', async () => {
	const v2 = await incomeStatement.handle(request('2'))
	const legacy = await incomeStatement.handle(request())
	expect([v2.status, legacy.status]).toEqual([200, 200])

	const v2Month = JSON.parse((v2 as { serializedJson: string }).serializedJson).data.monthly['2026-01']
	const legacyMonth = JSON.parse((legacy as { serializedJson: string }).serializedJson).data.monthly['2026-01']
	expect(v2Month).toEqual({
		timestamp: Date.parse('2026-01'),
		values: { Revenue: { value: 42, 'by-label': { Swap: 40 } } }
	})
	expect(legacyMonth).toEqual({ timestamp: Date.parse('2026-01'), Revenue: { value: 42, 'by-label': { Swap: 40 } } })

	expect(await incomeStatement.handle(request('2'))).toEqual(v2)
	expect(await incomeStatement.handle(request())).toEqual(legacy)
	expect(http.requests).toHaveLength(1)
})

test('rejects unsupported response versions before fetching data', async () => {
	expect(await incomeStatement.handle(request('3'))).toMatchObject({
		status: 400,
		body: { error: 'Invalid version: 3' }
	})
	expect(http.requests).toHaveLength(0)
})
