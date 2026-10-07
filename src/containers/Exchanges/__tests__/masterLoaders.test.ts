import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import {
	loadMasterExchangeDirectory,
	loadMasterExchangeProfile,
	loadMasterExchangeRanking,
	loadMasterResearchReports,
	MasterExchangeNotFoundError
} from '../server/master.loaders'
import {
	directoryResponse,
	executionResponse,
	indexResponse,
	metadataResponse,
	qualityRanksResponse,
	rankMethodologyResponse
} from './masterFixture'

const http = installFixtureFetch()
const url = (path: string) => `${MARKETS_SERVER_URL}/exchanges/${path}`
// 4xx fails without the retry delay a 5xx would add.
const missing = fixtureStatus(404, { error: 'Not Found' })

function serveProfile(extras: { execution?: unknown; ranks?: unknown; methodology?: unknown } = {}) {
	http.serve({
		[url('venue/metadata.json')]: metadataResponse(),
		[url('venue/index.json')]: indexResponse(),
		[url('execution-quality.json')]: extras.execution ?? missing,
		[url('quality-ranks.json')]: extras.ranks ?? missing,
		[url('rank-methodology.json')]: extras.methodology ?? missing,
		[url('directory.json')]: missing
	})
}

describe('directory loader', () => {
	test('renders without execution columns when the execution file is missing', async () => {
		http.serve({ [url('directory.json')]: directoryResponse([]), [url('execution-quality.json')]: missing })

		expect(await loadMasterExchangeDirectory()).toMatchObject({ rows: [], executionAvailable: false })
	})

	test('keeps execution columns for a loaded execution file with no measured venues', async () => {
		http.serve({
			[url('directory.json')]: directoryResponse([]),
			[url('execution-quality.json')]: { ...executionResponse(), venues: {} }
		})

		expect(await loadMasterExchangeDirectory()).toMatchObject({ rows: [], executionAvailable: true })
	})
})

describe('ranking loader', () => {
	test('builds the ranking page without a ranking when the ranks files are missing', async () => {
		http.serve({
			[url('directory.json')]: directoryResponse([]),
			[url('execution-quality.json')]: missing,
			[url('quality-ranks.json')]: missing,
			[url('rank-methodology.json')]: missing
		})

		expect(await loadMasterExchangeRanking()).toBeNull()
	})
})

describe('research loader', () => {
	test('fails the build when one primary chart payload fails', async () => {
		http.serve({
			[`${MARKETS_SERVER_URL}/charts/`]: { days: [], series: [], key: [] },
			[`${MARKETS_SERVER_URL}/charts/depth/1y.json`]: fixtureStatus(400, { error: 'Bad' })
		})

		await expect(loadMasterResearchReports()).rejects.toThrow('[400]')
	})
})

describe('profile loader', () => {
	test('renders a markets profile without execution or ranking when those files are missing', async () => {
		serveProfile()

		expect(await loadMasterExchangeProfile('venue')).toMatchObject({
			slug: 'venue',
			name: 'Venue Display',
			profileMode: 'markets',
			execution: null,
			quality: null
		})
	})

	test('keeps execution when only the ranking methodology is missing', async () => {
		serveProfile({ execution: executionResponse(), ranks: qualityRanksResponse() })

		const profile = await loadMasterExchangeProfile('venue')

		expect(profile.execution).toMatchObject({ hoursCovered: 24 })
		expect(profile.quality).toBeNull()
	})

	test('keeps the ranking when only execution is missing', async () => {
		serveProfile({ ranks: qualityRanksResponse(), methodology: rankMethodologyResponse() })

		const profile = await loadMasterExchangeProfile('venue')

		expect(profile.execution).toBeNull()
		expect(profile.quality).toMatchObject({ components: [{ key: 'E', label: 'Execution', score: 75 }] })
	})

	test('maps a metadata-only profile without requesting its index', async () => {
		http.serve({ [url('bitpanda/metadata.json')]: { ...metadataResponse(), profile_mode: 'metadata-only' } })

		expect(await loadMasterExchangeProfile('bitpanda')).toMatchObject({ profileMode: 'metadata-only' })
		expect(http.urls()).toEqual([url('bitpanda/metadata.json')])
	})

	test('classifies a metadata 404 as an unknown venue', async () => {
		http.serve({ [url('unknown/metadata.json')]: missing })

		await expect(loadMasterExchangeProfile('unknown')).rejects.toBeInstanceOf(MasterExchangeNotFoundError)
	})

	test('keeps other metadata failures fatal', async () => {
		http.serve({ [url('dex/metadata.json')]: fixtureStatus(400, { error: 'Bad' }) })

		const error = await loadMasterExchangeProfile('dex').catch((error: unknown) => error)

		expect(error).not.toBeInstanceOf(MasterExchangeNotFoundError)
		expect(String(error)).toContain('[400]')
	})

	test('keeps a missing markets index fatal rather than an unknown venue', async () => {
		serveProfile()
		http.serve({ [url('venue/index.json')]: missing })

		const error = await loadMasterExchangeProfile('venue').catch((error: unknown) => error)

		expect(error).not.toBeInstanceOf(MasterExchangeNotFoundError)
		expect(String(error)).toContain('[404]')
	})
})
