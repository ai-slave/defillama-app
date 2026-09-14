import { expect, test, vi } from 'vitest'
import type { IProtocol } from '../types'

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }))
vi.mock('../server/tableData.server', () => ({ getProtocolRankingsSnapshot: mocks.snapshot }))
vi.mock('~/utils/metadata', () => ({ default: { chainMetadata: {}, protocolMetadata: {}, categoriesAndTags: {} } }))
import { getStaticProps } from '~/pages/protocols'

test('/protocols ships a bounded rankings page and remote-mode metadata', async () => {
	const protocols: Array<IProtocol> = Array.from({ length: 52 }, (_, index) => ({
		id: String(index),
		name: `Protocol ${index}`,
		slug: `protocol-${index}`,
		category: 'Lending',
		chains: ['Ethereum'],
		tvl: { default: { tvl: index, tvlPrevDay: index, tvlPrevWeek: index, tvlPrevMonth: index } },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		strikeTvl: false,
		mcap: null,
		tokenPrice: null,
		mcaptvl: null
	}))
	mocks.snapshot.mockResolvedValue({ protocols, snapshot: 'abcdefghijklmnopqrst', availableActivityMetrics: [] })
	const result = await getStaticProps({})
	if (!('props' in result)) throw new Error('Expected page props')
	const props = await result.props
	expect([props.protocols.length, props.protocols[0]?.name, props.protocols.at(-1)?.name]).toEqual([
		50,
		'Protocol 51',
		'Protocol 2'
	])
	expect([props.protocolRankings.total, props.protocolRankings.snapshot, props.protocolRankings.hasMore]).toEqual([
		52,
		'abcdefghijklmnopqrst',
		true
	])
	expect(props.protocolRankings.nextCursor).not.toBeNull()
})
