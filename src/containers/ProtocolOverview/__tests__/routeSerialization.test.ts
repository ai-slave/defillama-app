import { beforeEach, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { getStaticProps as getProtocolStaticProps } from '~/pages/protocol/[protocol]'
import { getStaticProps as getProtocolActiveLoansStaticProps } from '~/pages/protocol/active-loans/[protocol]'
import { getStaticProps as getProtocolFeesStaticProps } from '~/pages/protocol/fees/[protocol]'
import { getStaticProps as getProtocolTvlStaticProps } from '~/pages/protocol/tvl/[protocol]'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

const http = installFixtureFetch()
const metadata = installMetadataSeeder()

const protocolMetrics = {
	id: '1',
	name: 'Test Protocol',
	url: 'https://example.com',
	hacks: [],
	raises: [],
	chains: ['Ethereum'],
	category: 'Lending',
	currentChainTvls: { Ethereum: 100 }
}

function serveProtocol(overrides: Record<string, unknown> = {}) {
	http.serve({ '/v2/metrics/tvl/protocol/test-protocol': { ...protocolMetrics, ...overrides } })
}

// A Next static-props result must survive JSON serialization; undefined values make the build fail.
function expectJsonRoundTrip(value: object) {
	expect(JSON.parse(JSON.stringify(value))).toStrictEqual(value)
}

beforeEach(() => {
	metadata.seed({
		protocolRouteIdBySlug: { 'test-protocol': 'test-protocol' },
		protocolMetadata: {
			'test-protocol': {
				name: 'test-protocol',
				displayName: 'Test Protocol',
				tvl: true,
				fees: true,
				revenue: true,
				holdersRevenue: true,
				borrowed: true
			}
		}
	})
})

test('serializes the overview route with its suggested questions', async () => {
	// Without fee metadata the overview skips its fee, revenue and income statement requests.
	metadata.seed({
		protocolMetadata: { 'test-protocol': { name: 'test-protocol', displayName: 'Test Protocol', tvl: true } }
	})
	serveProtocol()
	http.serve({
		'/v2/chart/tvl/protocol/test-protocol': [[1_700_000_000, 100]],
		'/lite/protocols2': { protocols: [], chains: [], parentProtocols: [] },
		'https://features.llama.fi/research/sponsors/lookup/protocol/': { sponsor: null, reports: [] },
		'/blockExplorers.json': [],
		'https://ai.llama.fi/suggested-questions': { questions: ['What is Test Protocol?'] },
		// Exchange-profile data is optional; the page renders without it.
		'https://markets.llama.fi/': fixtureStatus(404)
	})

	const result = await getProtocolStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({ props: { name: 'Test Protocol', entityQuestions: ['What is Test Protocol?'] } })
})

test('offers only the protocol TVL extras it reports on the TVL route', async () => {
	serveProtocol({ currentChainTvls: { Ethereum: 100, staking: 20, doublecounted: 30 } })

	const result = await getProtocolTvlStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({
		props: { toggleOptions: [{ name: 'Staking', key: 'staking' }], chainsUnique: ['Ethereum'] }
	})
})

test('keeps a zero revenue total and reports an unavailable holders revenue on the fees route', async () => {
	serveProtocol({ isParentProtocol: false, otherProtocols: null, deprecated: false, dimensions: null })
	const overview = (chains: Array<string>, totalAllTime: number) => ({
		name: 'test-protocol',
		displayName: 'Test Protocol',
		chains,
		totalAllTime,
		methodology: null,
		methodologyURL: null
	})
	const fees = `${V2_SERVER_URL}/metrics/fees/protocol/test-protocol`
	const feesChart = `${V2_SERVER_URL}/chart/fees/protocol/test-protocol`
	http.serve({
		[fees]: overview(['Ethereum'], 100),
		[feesChart]: [[1_700_000_000, 10]],
		[`${fees}?dataType=dailyRevenue`]: overview(['Arbitrum', 'Base'], 0),
		[`${feesChart}?dataType=dailyRevenue`]: [[1_700_000_000, 0]],
		[`${fees}?dataType=dailyHoldersRevenue`]: fixtureStatus(404),
		[`${feesChart}?dataType=dailyHoldersRevenue`]: fixtureStatus(404)
	})

	const result = await getProtocolFeesStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({
		props: {
			fees: { totalAllTime: 100 },
			revenue: { totalAllTime: 0 },
			holdersRevenue: null,
			protocolRevenueChains: ['Arbitrum', 'Base'],
			failedMetrics: ['Holders Revenue']
		}
	})
})

const feesMetrics = `${V2_SERVER_URL}/metrics/fees/protocol/test-protocol`
const feesChart = `${V2_SERVER_URL}/chart/fees/protocol/test-protocol`

function serveFeesRoute({ feesLabels, revenueLabels }: { feesLabels: unknown; revenueLabels: unknown }) {
	serveProtocol({ isParentProtocol: false, otherProtocols: null, deprecated: false, dimensions: null })
	const overview = (hasLabelBreakdown: boolean) => ({
		name: 'test-protocol',
		displayName: 'Test Protocol',
		chains: ['Ethereum'],
		methodology: null,
		methodologyURL: null,
		hasLabelBreakdown
	})
	http.serve({
		[feesMetrics]: overview(feesLabels !== null),
		[feesChart]: [[1_700_000_000, 12]],
		[`${feesMetrics}?dataType=dailyRevenue`]: overview(revenueLabels !== null),
		[`${feesChart}?dataType=dailyRevenue`]: [[1_700_000_000, 6]],
		[`${feesMetrics}?dataType=dailyHoldersRevenue`]: fixtureStatus(404),
		[`${feesChart}?dataType=dailyHoldersRevenue`]: fixtureStatus(404),
		...(feesLabels !== null ? { [`${feesChart}/label-breakdown`]: feesLabels } : {}),
		...(revenueLabels !== null ? { [`${feesChart}/label-breakdown?dataType=dailyRevenue`]: revenueLabels } : {})
	})
}

test('lists financial labels only for the fee metrics that report a label breakdown', async () => {
	serveFeesRoute({ feesLabels: [[1_700_000_000, { 'Perp Fees': 10, 'Spot Fees': 2 }]], revenueLabels: null })

	const result = await getProtocolFeesStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({
		props: { protocolFeesLabels: ['Perp Fees', 'Spot Fees'], protocolRevenueLabels: [] }
	})
	expect(http.urls()).not.toContain(`${feesChart}/label-breakdown?dataType=dailyRevenue`)
})

test('keeps the fees route when a financial label breakdown fails', async () => {
	serveFeesRoute({
		feesLabels: fixtureStatus(500),
		revenueLabels: [[1_700_000_000, { 'Perp Fees': 5, 'Spot Fees': 1 }]]
	})

	const result = await getProtocolFeesStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({
		props: { protocolFeesLabels: [], protocolRevenueLabels: ['Perp Fees', 'Spot Fees'] }
	})
})

test('serializes active-loans props without TVL toggle controls', async () => {
	serveProtocol({
		otherProtocols: null,
		currentChainTvls: { Ethereum: 100, staking: 20, borrowed: 0, 'Ethereum-borrowed': 10 }
	})

	const result = await getProtocolActiveLoansStaticProps({ params: { protocol: 'test-protocol' } })

	expectJsonRoundTrip(result)
	expect(result).toMatchObject({ props: { otherProtocols: [] } })
	expect(result).not.toHaveProperty('props.toggleOptions')
})
