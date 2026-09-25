import { beforeEach, expect, test, vi } from 'vitest'
import type { ApiQuery } from '~/server/api/types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import type { ProtocolLite } from '../api.types'

const mocks = vi.hoisted(() => ({
	current: vi.fn(),
	read: vi.fn(),
	publish: vi.fn()
}))
vi.mock('~/server/datasetSnapshots/redisBlobStore.server', async (original) => ({
	...(await original<typeof import('~/server/datasetSnapshots/redisBlobStore.server')>()),
	createRedisBlobStore: () => ({ readCurrent: mocks.current, readVersion: mocks.read, publish: mocks.publish })
}))

const http = installFixtureFetch()
const liteProtocols: Array<ProtocolLite> = Array.from({ length: 80 }, (_, i) => ({
	defillamaId: String(i),
	name: `Protocol ${i}`,
	symbol: '-',
	logo: null,
	url: '',
	category: 'Lending',
	chains: ['Ethereum'],
	listedAt: i,
	mcap: null,
	geckoId: null,
	tvl: i,
	tvlPrevDay: i,
	tvlPrevWeek: i,
	tvlPrevMonth: i,
	chainTvls: { Ethereum: { tvl: i, tvlPrevDay: i, tvlPrevWeek: i, tvlPrevMonth: i } }
}))
const serveProtocols = (protocols: Array<ProtocolLite>) =>
	http.serve({
		'/lite/protocols2': { protocols, chains: ['Ethereum'], parentProtocols: [], protocolCategories: ['Lending'] },
		'/raises': { raises: [] }
	})
const builds = () => http.requests.filter(({ url }) => url.pathname === '/lite/protocols2').length

// The snapshot and result caches are module state, so every test starts from a fresh module graph.
let protocolListsApi: typeof import('../server/api').protocolListsApi
let getProtocolListInitialProps: typeof import('../server/tableData.server').getProtocolListInitialProps
const request = (query: ApiQuery) => protocolListsApi.handle({ method: 'GET', url: '', headers: {}, query })
async function startWorker() {
	vi.resetModules()
	;({ protocolListsApi } = await import('../server/api'))
	;({ getProtocolListInitialProps } = await import('../server/tableData.server'))
}
beforeEach(async () => {
	vi.clearAllMocks()
	await startWorker()
	serveProtocols(liteProtocols)
	mocks.current.mockResolvedValue(null)
	mocks.publish.mockResolvedValue(true)
	mocks.read.mockImplementation(
		async (_kind, version) =>
			mocks.publish.mock.calls.map(([snapshot]) => snapshot).find((snapshot) => snapshot.version === version) ?? null
	)
})
test('initial props and subsequent pages share one eligible snapshot with compact initial rows', async () => {
	const initial = await getProtocolListInitialProps('recent')
	expect([
		initial.protocols.length,
		initial.protocols[0]?.name,
		initial.protocols.at(-1)?.name,
		initial.protocolList.total
	]).toEqual([50, 'Protocol 79', 'Protocol 30', 80])
	expect(initial.protocols[0]?.chainTvls).toEqual({})
	expect(initial).not.toHaveProperty('forkedList')
	const result = await request({
		kind: 'recent',
		snapshot: initial.protocolList.version,
		cursor: initial.protocolList.nextCursor!
	})
	expect(result.status).toBe(200)
	const page = (result as { body: { rows: Array<{ name: string }>; total: number; hasMore: boolean } }).body
	expect([page.rows.length, page.rows[0]?.name, page.rows.at(-1)?.name, page.total, page.hasMore]).toEqual([
		30,
		'Protocol 29',
		'Protocol 0',
		80,
		false
	])
	expect(builds()).toBe(1)
})
test('API filtering and complete CSV export reuse the pinned population', async () => {
	const initial = await getProtocolListInitialProps('airdrops')
	const result = await request({ kind: 'airdrops', snapshot: initial.protocolList.version, minTvl: '78', csv: 'true' })
	expect(result.status).toBe(200)
	expect((result as { body: string }).body).toBe(
		'Name,Category,TVL,Disclosed Money Raised,Undisclosed Funding Rounds,Listed At,1d TVL Change,7d TVL Change,1m TVL Change\nProtocol 79,Lending,79,,,79,0,0,0\nProtocol 78,Lending,78,,,78,0,0,0'
	)
	expect(builds()).toBe(1)
})
test('missing versions fail export and signal a page replacement instead of mixing rows', async () => {
	const initial = await getProtocolListInitialProps('recent')
	mocks.current.mockResolvedValue(mocks.publish.mock.calls[0]![0])
	const old = 'abcdefghijklmnopqrst'
	expect(await request({ kind: 'recent', snapshot: old })).toEqual({
		status: 409,
		body: { error: 'snapshot_mismatch', snapshot: initial.protocolList.version }
	})
	expect((await request({ kind: 'recent', snapshot: old, csv: 'true' })).status).toBe(503)
})
test('without Redis, a rebuild is accepted only when its content hash matches the pinned version', async () => {
	mocks.publish.mockResolvedValue(false)
	mocks.read.mockResolvedValue(null)
	const initial = await getProtocolListInitialProps('recent')
	await startWorker()
	expect(
		(
			await request({
				kind: 'recent',
				snapshot: initial.protocolList.version,
				cursor: initial.protocolList.nextCursor!
			})
		).status
	).toBe(200)
	expect(builds()).toBe(2)
	await startWorker()
	serveProtocols([])
	expect((await request({ kind: 'recent', snapshot: initial.protocolList.version })).status).toBe(409)
	expect((await request({ kind: 'recent', snapshot: initial.protocolList.version, csv: 'true' })).status).toBe(503)
})
test('rejects malformed query and cursor input', async () => {
	expect((await request({ kind: 'unknown' })).status).toBe(400)
	expect((await request({ kind: 'recent', snapshot: 'bad' })).status).toBe(400)
	expect((await request({ kind: 'recent', sort: 'unsupported' })).status).toBe(400)
	const initial = await getProtocolListInitialProps('recent')
	expect((await request({ kind: 'recent', snapshot: initial.protocolList.version, cursor: 'bad' })).status).toBe(400)
})
