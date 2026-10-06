import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AI_SERVER, SERVER_URL, V2_SERVER_URL } from '~/constants'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { resetUtrBackoff } from '~/containers/TokenRights/server/badge.server'
import { getStaticProps } from '~/pages/revenue'
import { clearResultCache } from '~/server/api/resultCache'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { TokenDirectory } from '~/utils/tokenDirectory'

// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/AdapterMetrics/AdapterByChain', () => ({ AdapterByChain: () => null }))

function rightsEntry(id: string, name: string): IRawTokenRightsEntry {
	return {
		'Protocol Name': name,
		Token: [name.toUpperCase()],
		'Governance Decisions': ['AAVE'],
		'Treasury Decisions': ['AAVE'],
		'Revenue Decisions': ['AAVE'],
		'Fee Switch Status': 'ON',
		Buybacks: ['AAVE'],
		Dividends: ['None'],
		Burns: 'None',
		'Equity Revenue Capture': 'No',
		'DefiLlama ID': id
	}
}

const dataset = vi.hoisted(() => ({ fail: false, entries: [] as Array<IRawTokenRightsEntry> }))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({
	fetchTokenRightsEntries: async () => {
		if (dataset.fail) throw new Error('token rights snapshot unavailable')
		return dataset.entries
	}
}))

const http = installFixtureFetch()
const metadata = installMetadataSeeder()

const UTR_LEADERBOARD_URL = 'https://quant.forgd.com/api/utr/leaderboard'
const METRICS_URL = `${V2_SERVER_URL}/metrics/fees`
const LEADERBOARD = {
	postTge: { rows: [{ coingeckoId: 'aave', notRated: false, grade: 'AA', projectName: 'Aave' }] },
	preTge: { rows: [] }
}

const AAVE_ROW = {
	defillamaId: 'parent#aave',
	name: 'Aave',
	displayName: 'Aave',
	slug: 'aave',
	category: 'Lending',
	logo: '',
	chains: ['Ethereum'],
	linkedProtocols: [],
	total24h: 10
}

function setup({
	utr = LEADERBOARD,
	rows = [AAVE_ROW],
	tokenDirectory = {}
}: { utr?: unknown; rows?: Array<Record<string, unknown>>; tokenDirectory?: TokenDirectory } = {}) {
	metadata.seed({
		protocolMetadata: { 'parent#aave': { name: 'aave', displayName: 'Aave', gecko_id: 'aave', tokenRights: true } },
		chainMetadata: {},
		tokenDirectory
	} as unknown as Partial<MetadataCache>)
	http.serve({
		[METRICS_URL]: { chain: 'All', allChains: ['Ethereum'], total24h: 10, protocols: rows },
		[`${V2_SERVER_URL}/chart/fees`]: [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], parentProtocols: [] },
		[UTR_LEADERBOARD_URL]: utr,
		[`${AI_SERVER}/suggested-questions`]: { questions: [], suggestGlobal: false }
	})
}

beforeEach(() => {
	dataset.fail = false
	dataset.entries = [rightsEntry('parent#aave', 'Aave')]
	clearResultCache()
	resetUtrBackoff()
})

async function rankedRows() {
	const result = await getStaticProps({})
	if (!('props' in result)) throw new Error('expected props')
	return result.props.protocols
}

async function aaveToken() {
	return (await rankedRows())[0].token
}

describe('revenue token badges', () => {
	test('keeps UTR grades when token rights fail to load', async () => {
		dataset.fail = true
		setup()

		const token = await aaveToken()

		expect(token?.rights).toBeNull()
		expect(token?.utr?.grade).toBe('AA')
	})

	test('keeps the token rights pie when UTR fails to load', async () => {
		setup({ utr: fixtureStatus(503) })

		const token = await aaveToken()

		expect(token?.rights?.preview.protocolName).toBe('Aave')
		expect(token?.utr).toBeNull()
	})

	test('requests the rankings while UTR is still loading', async () => {
		// UTR answers only once the rankings request has started; if the page waited for UTR first, this times out.
		setup({
			utr: async () => {
				await waitForUi(
					() => {
						if (!http.urls().some((url) => url.startsWith(METRICS_URL))) throw new Error('rankings not requested yet')
					},
					{ timeout: 1000 }
				)
				return LEADERBOARD
			}
		})

		const token = await aaveToken()

		expect(token?.utr?.grade).toBe('AA')
	})

	test('links rights only to the token page that shows them', async () => {
		// Pendle's rights are filed under its V2 child id, while the PENDLE page reads its parent id.
		dataset.entries = [rightsEntry('parent#aave', 'Aave'), rightsEntry('382', 'Pendle')]
		const child = (
			defillamaId: string,
			name: string,
			parent: string,
			linkedProtocols: Array<string>,
			total24h: number
		) => ({
			...AAVE_ROW,
			defillamaId,
			name,
			displayName: name,
			slug: name.toLowerCase().replace(/ /g, '-'),
			parentProtocol: parent,
			linkedProtocols,
			total24h
		})
		setup({
			rows: [
				// A lone child ranks as its own row and looks up its own id before its parent's.
				child('111', 'Aave V2', 'parent#aave', [], 20),
				child('382', 'Pendle V2', 'parent#pendle', ['Pendle', 'Pendle V2', 'Boros'], 5),
				child('9001', 'Boros', 'parent#pendle', ['Pendle', 'Pendle V2', 'Boros'], 1)
			],
			tokenDirectory: {
				'aave-v2': { name: 'Aave V2 Token', symbol: 'AAVEV2', protocolId: '111', tokenRights: true },
				aave: { name: 'Aave', symbol: 'AAVE', protocolId: 'parent#aave', tokenRights: true },
				pendle: { name: 'Pendle', symbol: 'PENDLE', protocolId: 'parent#pendle', tokenRights: true }
			}
		})

		const rows = await rankedRows()

		expect(rows.map((row) => [row.name, row.token?.rights?.preview.protocolName, row.token?.rights?.href])).toEqual([
			['Aave V2', 'Aave', '/token/AAVE#token-rights-and-value-accrual'],
			['Pendle', 'Pendle', null]
		])
	})
})
