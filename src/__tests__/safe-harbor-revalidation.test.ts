import { assert, expect, test, vi } from 'vitest'
import type { ProtocolRankingsCanonicalSnapshot } from '~/containers/ProtocolRankings/server/tableData.server'
import type { IProtocol } from '~/containers/ProtocolRankings/types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'

const storage = vi.hoisted(() => ({ readCurrent: vi.fn() }))
vi.mock('~/server/datasetSnapshots/redisBlobStore.server', async (original) => ({
	...(await original<typeof import('~/server/datasetSnapshots/redisBlobStore.server')>()),
	createRedisBlobStore: () => storage
}))

import { getStaticProps } from '~/pages/safe-harbor-agreements'

const http = installFixtureFetch()
const metadata = installMetadataSeeder()

function protocol(name: string, tvl: number | null): IProtocol {
	return {
		name,
		slug: name.toLowerCase(),
		category: null,
		chains: ['Ethereum'],
		tvl: { default: { tvl, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null } },
		tvlChange: null,
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: false
	}
}

test('lists only enrolled projects with metadata, sorts missing TVL last, and preserves zero metrics', async () => {
	metadata.seed({
		protocolMetadata: {
			missing: { name: 'missing', displayName: 'Missing', chains: ['Ethereum'] },
			zero: { name: 'zero', displayName: 'Zero', chains: ['Ethereum'] },
			funded: { name: 'funded', displayName: 'Funded', chains: ['Ethereum'] },
			unenrolled: { name: 'unenrolled', displayName: 'Unenrolled', chains: ['Ethereum'] }
		}
	})
	http.serve({
		'/_fe/static/safe-harbor-projects': {
			missing: true,
			zero: true,
			funded: true,
			unenrolled: false,
			unknown: true
		}
	})
	storage.readCurrent.mockResolvedValue({
		chain: 'All',
		createdAt: Date.now(),
		snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T',
		availableActivityMetrics: [],
		source: { chains: ['Ethereum'], feeProtocols: null, dexs: null, perps: null },
		protocols: [
			{
				...protocol('Funded', 100),
				fees: {
					total24h: 10,
					total7d: null,
					total30d: null,
					total1y: null,
					annualized1y: null,
					monthlyAverage1y: null,
					totalAllTime: null,
					pf: null
				},
				revenue: {
					total24h: 5,
					total7d: null,
					total30d: null,
					total1y: null,
					annualized1y: null,
					monthlyAverage1y: null,
					totalAllTime: null,
					ps: null
				},
				dexs: { total24h: 20, total7d: null, total30d: null, totalAllTime: null, change_7dover7d: null }
			},
			{
				...protocol('Zero', 0),
				dexs: { total24h: 0, total7d: null, total30d: null, totalAllTime: null, change_7dover7d: null }
			},
			protocol('Unenrolled', 1000)
		]
	} satisfies ProtocolRankingsCanonicalSnapshot)

	const result = await getStaticProps({} as never)
	assert('props' in result)
	expect(result.props.protocols).toMatchObject([
		{
			name: 'Funded',
			tvl: 100,
			fees: 10,
			revenue: 5,
			dexVolume: 20,
			url: 'https://safeharbor.securityalliance.org/database/funded'
		},
		{ name: 'Zero', tvl: 0, fees: null, revenue: null, dexVolume: 0 },
		{ name: 'Missing', tvl: null, fees: null, revenue: null, dexVolume: null }
	])
	expect(result.revalidate).toBeGreaterThan(0)
})
