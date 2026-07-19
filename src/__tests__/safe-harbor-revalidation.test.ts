import { expect, it, vi } from 'vitest'

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: () => 123
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: (_label: string, fn: any) => fn
}))

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn().mockResolvedValue({ protocol: true })
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: {
		chainMetadata: {},
		protocolMetadata: {
			protocol: { displayName: 'Protocol', chains: ['Ethereum'] }
		}
	}
}))

vi.mock('~/containers/ProtocolRankings/queries.server', () => ({
	getProtocolsByChain: vi.fn().mockResolvedValue({
		protocols: [
			{
				name: 'Protocol',
				tvl: { default: { tvl: 100 } },
				fees: { total24h: 10 },
				revenue: { total24h: 5 },
				dexs: { total24h: 20 }
			}
		]
	})
}))

import { getStaticProps } from '~/pages/safe-harbor-agreements'

it('revalidates changing Safe Harbor rankings hourly', async () => {
	await expect(getStaticProps({} as never)).resolves.toMatchObject({
		props: {
			protocols: [{ name: 'Protocol', tvl: 100, fees: 10, revenue: 5, dexVolume: 20 }]
		},
		revalidate: 123
	})
})
