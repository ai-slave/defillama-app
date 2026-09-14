import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'

// Opt-in capture replay; never fetches network data or writes fixtures to the repository.
const capture = process.env.PROTOCOL_LIST_MEASUREMENT_DIR
const mocks = vi.hoisted(() => ({ lite: vi.fn(), raises: vi.fn(), claims: vi.fn(), rankings: vi.fn() }))
vi.mock('../api', () => ({ fetchProtocols: mocks.lite, fetchAirdropsConfig: mocks.claims }))
vi.mock('~/containers/Raises/api', () => ({ fetchRaises: mocks.raises }))
vi.mock('~/api/pricing', () => ({ fetchCoinPrices: async () => ({}) }))
vi.mock('~/containers/AdapterMetrics/api', () => ({ fetchAdapterChainMetrics: async () => null }))
vi.mock('~/containers/AdapterMetrics/queries', () => ({ getAdapterChainOverview: async () => null }))
vi.mock('~/containers/Incentives/queries', () => ({ getProtocolEmissionsLookupFromAggregated: async () => null }))
vi.mock('~/containers/ProtocolRankings/server/tableData.server', () => ({
	getProtocolRankingsSnapshot: mocks.rankings
}))
vi.mock('~/utils/metadata', () => ({ default: { chainMetadata: {}, protocolMetadata: {}, categoriesAndTags: {} } }))
vi.mock('~/server/datasetSnapshots/redisBlobStore.server', async (original) => ({
	...(await original<typeof import('~/server/datasetSnapshots/redisBlobStore.server')>()),
	createRedisBlobStore: () => ({ readCurrent: async () => null, publish: async () => true })
}))
import { getProtocolsByChain } from '~/containers/ProtocolRankings/queries.server'
import { PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS } from '~/containers/ProtocolRankings/sortAccessors'
import { normalizeRaisesApiResponse } from '~/containers/Raises/model'
import { getStaticProps as airdropsProps } from '~/pages/airdrops'
import { getStaticProps as protocolsProps } from '~/pages/protocols'
import { getStaticProps as recentProps } from '~/pages/recent'
import { getAirdropsProtocols, getRecentProtocols } from '../queries'

test.skipIf(!capture)('compares actual page-props builders over identical captured inputs', async () => {
	const read = (file: string) => JSON.parse(readFileSync(join(capture!, file), 'utf8'))
	mocks.lite.mockResolvedValue(read('lite.json'))
	mocks.claims.mockResolvedValue(read('claims.json'))
	mocks.raises.mockResolvedValue(normalizeRaisesApiResponse(read('raises.json')))
	const rankings = await getProtocolsByChain({
		chain: 'All',
		chainMetadata: {},
		protocolMetadata: read('metadata.json'),
		includeExtendedMetrics: true
	})
	const snapshot = { protocols: rankings!.protocols, snapshot: 'abcdefghijklmnopqrst', availableActivityMetrics: [] }
	mocks.rankings.mockResolvedValue(snapshot)
	const baseRow = (row: import('~/containers/ProtocolRankings/types').IChildProtocol) => {
		const base = { ...row }
		for (const key of PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS) delete base[key]
		return base
	}
	const beforeProtocols = {
		protocols: snapshot.protocols.map((row) => ({
			...baseRow(row),
			...(row.childProtocols ? { childProtocols: row.childProtocols.map(baseRow) } : {})
		}))
	}
	const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value))
	const protocolResult = await protocolsProps({})
	const airdropResult = await airdropsProps({})
	const recentResult = await recentProps({})
	if (!('props' in protocolResult) || !('props' in airdropResult) || !('props' in recentResult))
		throw new Error('Expected page props')
	const measurements = []
	for (const [page, before, after] of [
		['protocols', beforeProtocols, await protocolResult.props],
		['airdrops', await getAirdropsProtocols(), await airdropResult.props],
		['recent', await getRecentProtocols(), await recentResult.props]
	] as const) {
		expect(after.protocols).toHaveLength(50)
		expect(bytes(after)).toBeLessThan(bytes(before))
		measurements.push({
			page,
			eligibleRows: before.protocols.length,
			initialRows: after.protocols.length,
			beforeBytes: bytes(before),
			afterBytes: bytes(after)
		})
	}
	writeFileSync(join(capture!, 'results.json'), JSON.stringify(measurements, null, 2))
	console.log(JSON.stringify(measurements))
})
