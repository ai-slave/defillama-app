import { afterEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
vi.mock('~/server/datasetSnapshots/redisBlobStore.server', async (original) => ({
	...(await original<typeof import('~/server/datasetSnapshots/redisBlobStore.server')>()),
	createRedisBlobStore: () => ({
		readCurrent: async () => null,
		readVersion: async () => null,
		publish: async () => false
	})
}))
import { getProtocolListSnapshot, readProtocolListSnapshot } from '../server/tableData.server'

const http = installFixtureFetch()
const serveChains = (chains: Array<string>) =>
	http.serve({ '/lite/protocols2': { protocols: [], chains, parentProtocols: [], protocolCategories: [] } })

afterEach(() => vi.useRealTimers())
test('retains exact older versions locally after latest refreshes without Redis', async () => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-09-14T00:00:00Z'))
	serveChains(['Ethereum'])
	const first = await getProtocolListSnapshot('recent')
	vi.advanceTimersByTime(10 * 60 * 1000)
	serveChains(['Ethereum', 'Base'])
	const second = await getProtocolListSnapshot('recent')
	expect(second.version).not.toBe(first.version)
	expect((await readProtocolListSnapshot('recent', first.version))?.chainList).toEqual(['Ethereum'])
	expect((await readProtocolListSnapshot('recent', second.version))?.chainList).toEqual(['Ethereum', 'Base'])
	vi.advanceTimersByTime(5 * 60 * 60 * 1000)
	expect(await readProtocolListSnapshot('recent', first.version)).toBeNull()
})
