import { beforeEach, expect, test, vi } from 'vitest'
import { getStaticProps } from '~/pages/chart/protocol/[protocol]'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

const { acquireOptionalYieldsSnapshot } = vi.hoisted(() => ({ acquireOptionalYieldsSnapshot: vi.fn() }))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireOptionalYieldsSnapshot }))

const http = installFixtureFetch()
const metadata = installMetadataSeeder()

beforeEach(() => {
	acquireOptionalYieldsSnapshot.mockReset().mockResolvedValue(null)
	metadata.seed({
		protocolRouteIdBySlug: { 'test-protocol': 'test-protocol', 'old-name': 'test-protocol' },
		protocolMetadata: {
			'test-protocol': { name: 'test-protocol', displayName: 'Test Protocol', tvl: true, yields: true }
		}
	})
	http.serve({
		'/v2/metrics/tvl/protocol/test-protocol': {
			id: '1',
			name: 'Test Protocol',
			url: 'https://example.com',
			hacks: [],
			raises: [],
			chains: ['Ethereum'],
			category: 'Lending',
			currentChainTvls: { Ethereum: 100 }
		},
		'/v2/chart/tvl/protocol/test-protocol': [[1_700_000_000, 100]],
		'/lite/protocols2': { protocols: [], chains: [], parentProtocols: [] },
		'https://features.llama.fi/research/sponsors/lookup/protocol/': { sponsor: null, reports: [] },
		'/blockExplorers.json': []
	})
})

test('builds serializable chart page props when the optional Yields snapshot is unavailable', async () => {
	const result = await getStaticProps({ params: { protocol: 'test-protocol' } })

	expect(result).toMatchObject({ props: { name: 'Test Protocol', availableCharts: ['TVL'], yields: null } })
	// Chart embeds never render the FAQ, so its data stays out of the page payload.
	expect(result).not.toHaveProperty('props.faqItems')
	expect(JSON.parse(JSON.stringify(result))).toStrictEqual(result)
})

test('redirects a previous protocol slug to the canonical chart page', async () => {
	expect(await getStaticProps({ params: { protocol: 'old-name' } })).toMatchObject({
		redirect: { destination: '/chart/protocol/test-protocol' }
	})
	expect(http.requests).toHaveLength(0)
})

test('returns not found for an unknown protocol', async () => {
	expect(await getStaticProps({ params: { protocol: 'missing' } })).toEqual({ notFound: true })
})
