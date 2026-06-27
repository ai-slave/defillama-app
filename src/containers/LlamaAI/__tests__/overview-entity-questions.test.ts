import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchEntityQuestions: vi.fn(),
	getChainOverviewData: vi.fn(),
	getProtocolOverviewPageData: vi.fn()
}))

vi.mock('~/containers/LlamaAI/api', () => ({
	fetchEntityQuestions: mocks.fetchEntityQuestions
}))

vi.mock('~/containers/ChainOverview/queries.server', () => ({
	getChainOverviewData: mocks.getChainOverviewData
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolOverviewPageData: mocks.getProtocolOverviewPageData
}))

vi.mock('~/layout', () => ({
	default: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('~/containers/ChainOverview', () => ({
	ChainOverview: () => null
}))

vi.mock('~/containers/ChainOverview/Announcement', () => ({
	ChainOverviewAnnouncement: () => null
}))

vi.mock('~/containers/ProtocolOverview', () => ({
	ProtocolOverview: () => null
}))

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: vi.fn(() => 22)
}))

vi.mock('~/utils/perf', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/perf')>()
	return {
		...actual,
		withPerformanceLogging: <T extends (...args: Array<unknown>) => unknown>(_name: string, fn: T) => fn
	}
})

vi.mock('~/utils/metadata', () => ({
	default: {
		chainMetadata: {
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		},
		chainRouteKeyBySlug: {
			ethereum: 'ethereum'
		},
		protocolMetadata: {
			aave: { id: 'aave', name: 'Aave', displayName: 'Aave' }
		},
		protocolRouteIdBySlug: {
			aave: 'aave'
		},
		categoriesAndTags: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		protocolLlamaswapDataset: {},
		rwaList: { chains: [] },
		tokenlist: {},
		cgExchangeIdentifiers: [],
		emissionsSupplyMetrics: {},
		cexRouteIdBySlug: {}
	}
}))

vi.mock('~/containers/Cexs/server/routes', () => ({
	resolveCexParamFromMetadata: vi.fn(() => null)
}))

const chainPageData = {
	metadata: { name: 'Ethereum' },
	description: 'Ethereum overview',
	tvlAndFeesOptions: []
}

const protocolPageData = {
	name: 'Aave',
	seoTitle: 'Aave Stats',
	seoDescription: 'Aave overview',
	metrics: {},
	token: { symbol: null },
	chartDenominations: []
}

describe('overview entity questions', () => {
	it('keeps chain getStaticProps renderable when entity questions fail', async () => {
		mocks.getChainOverviewData.mockResolvedValueOnce(chainPageData)
		mocks.fetchEntityQuestions.mockRejectedValueOnce(new Error('questions unavailable'))
		const { getStaticProps } = await import('~/pages/chain/[chain]')

		const result = await getStaticProps({ params: { chain: 'ethereum' } } as never)

		expect(result).toMatchObject({
			props: {
				...chainPageData,
				entityQuestions: []
			}
		})
		expect(mocks.fetchEntityQuestions).toHaveBeenCalledWith('Ethereum', 'chain', undefined, { throwOnError: true })
	})

	it('keeps protocol getStaticProps renderable when entity questions fail', async () => {
		mocks.getProtocolOverviewPageData.mockResolvedValueOnce(protocolPageData)
		mocks.fetchEntityQuestions.mockRejectedValueOnce(new Error('questions unavailable'))
		const { getStaticProps } = await import('~/pages/protocol/[protocol]')

		const result = await getStaticProps({ params: { protocol: 'aave' } } as never)

		expect(result).toMatchObject({
			props: {
				...protocolPageData,
				entityQuestions: []
			}
		})
		expect(mocks.fetchEntityQuestions).toHaveBeenCalledWith('aave', 'protocol', undefined, { throwOnError: true })
	})
})
