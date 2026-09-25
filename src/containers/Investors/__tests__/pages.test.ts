import type { GetServerSidePropsContext } from 'next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DATASETS_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'

const network = installFixtureFetch()

// THORChain is the one standalone IR project with server data. Its fetcher skips the network when
// the emissions list does not include its slug, and requests the emissions API when it does.
const THORCHAIN_UNLOCKS_WITHOUT_EMISSIONS = { thorchainUnlocks: { emissions: null, initialTokenMarketData: null } }

function context(host: string | undefined, protocol?: string): GetServerSidePropsContext {
	return {
		req: { headers: { host } },
		res: {},
		params: protocol ? { protocol } : {},
		query: {},
		resolvedUrl: protocol ? `/investors/${protocol}` : '/investors'
	} as GetServerSidePropsContext
}

// config.ts reads NEXT_PUBLIC_INVESTORS_PREVIEW when it loads, so every test imports fresh pages.
// The metadata module is fresh too, which is why it is seeded here and not with installMetadataSeeder.
// Listing every server-data slug by default makes any server-data load an unfixtured request.
async function loadPages(emissionsProtocolsList = ['thorchain-dex', 'uniswap']) {
	const [landing, all, project, metadata] = await Promise.all([
		import('~/pages/investors'),
		import('~/pages/investors/all'),
		import('~/pages/investors/[protocol]'),
		import('~/utils/metadata')
	])
	metadata.default.emissionsProtocolsList = emissionsProtocolsList
	return { landing: landing.getServerSideProps, all: all.getServerSideProps, project: project.getServerSideProps }
}

beforeEach(() => {
	vi.resetModules()
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_SITE', '')
	vi.stubEnv('NEXT_PUBLIC_SUPERLUMINAL_DASHBOARD_ID', '')
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('standalone IR server pages', () => {
	test('returns site identity for both landings and preserves the enterprise all redirect', async () => {
		const { landing, all } = await loadPages()
		expect(await landing(context('investors.defillama.com'))).toEqual({ props: { investorsSiteId: 'investors' } })
		expect(await landing(context('enterprise.defillama.com'))).toEqual({ props: { investorsSiteId: 'enterprise' } })
		expect(await all(context('enterprise.defillama.com'))).toEqual({
			redirect: { destination: '/odyssey-ecosystem', permanent: false }
		})
	})

	test('uses the same forwarded site for the landing, all page and project data', async () => {
		const { landing, all, project } = await loadPages([])
		const investorRequest = context('app-origin.example', 'thorchain')
		investorRequest.req.headers['x-forwarded-host'] = 'investors.defillama.com'
		const enterpriseRequest = context('app-origin.example', 'odyssey-ecosystem')
		enterpriseRequest.req.headers['x-forwarded-host'] = 'enterprise.defillama.com'
		expect(await landing(investorRequest)).toEqual({ props: { investorsSiteId: 'investors' } })
		expect(await landing(enterpriseRequest)).toEqual({ props: { investorsSiteId: 'enterprise' } })
		expect(await all(investorRequest)).toEqual({
			props: { investorsSiteId: 'investors', customServerData: THORCHAIN_UNLOCKS_WITHOUT_EMISSIONS }
		})
		expect(await all(enterpriseRequest)).toEqual({ redirect: { destination: '/odyssey-ecosystem', permanent: false } })
		expect(await project(investorRequest)).toEqual({
			props: {
				investorsSiteId: 'investors',
				protocol: 'thorchain',
				customServerData: THORCHAIN_UNLOCKS_WITHOUT_EMISSIONS
			}
		})
		expect(await project(enterpriseRequest)).toEqual({
			props: { investorsSiteId: 'enterprise', protocol: 'odyssey-ecosystem', customServerData: {} }
		})
		enterpriseRequest.params = { protocol: 'thorchain' }
		expect(await project(enterpriseRequest)).toEqual({ notFound: true })
		investorRequest.req.headers['x-forwarded-host'] = 'defillama.com'
		expect(await landing(investorRequest)).toEqual({ notFound: true })
	})

	test('derives the site from the path while the LB host is opaque', async () => {
		const { landing, all, project } = await loadPages([])
		const opaque = (protocol?: string) => context('app-origin.example', protocol)
		expect(await landing(opaque())).toEqual({ props: { investorsSiteId: 'investors' } })
		expect(await all(opaque())).toEqual({
			props: { investorsSiteId: 'investors', customServerData: THORCHAIN_UNLOCKS_WITHOUT_EMISSIONS }
		})
		expect(await project(opaque('spark'))).toEqual({
			props: { investorsSiteId: 'investors', protocol: 'spark', customServerData: {} }
		})
		expect(await project(opaque('odyssey-ecosystem'))).toEqual({
			props: { investorsSiteId: 'enterprise', protocol: 'odyssey-ecosystem', customServerData: {} }
		})
		for (const protocol of ['kpk', 'uniswap', 'unknown']) {
			expect(await project(opaque(protocol))).toEqual({ notFound: true })
		}
	})

	test('isolates overlapping project requests in the same imported pages', async () => {
		const { project } = await loadPages([])
		const [thorchain, odyssey] = await Promise.all([
			project(context('investors.defillama.com', 'thorchain')),
			project(context('enterprise.defillama.com', 'odyssey-ecosystem'))
		])
		expect(thorchain).toEqual({
			props: {
				investorsSiteId: 'investors',
				protocol: 'thorchain',
				customServerData: THORCHAIN_UNLOCKS_WITHOUT_EMISSIONS
			}
		})
		expect(odyssey).toEqual({
			props: { investorsSiteId: 'enterprise', protocol: 'odyssey-ecosystem', customServerData: {} }
		})
	})

	// No emissions fixture is served, so a data load before the 404 fails the test as an unfixtured request.
	test('returns real 404s before fetching data for direct unavailable project requests', async () => {
		const { project } = await loadPages()
		const requests = [
			['investors.defillama.com', 'odyssey-ecosystem'],
			['enterprise.defillama.com', 'thorchain'],
			['investors.defillama.com', 'kpk'],
			['investors.defillama.com', 'uniswap'],
			['enterprise.defillama.com', 'kpk'],
			['investors.defillama.com', 'unknown']
		]
		await Promise.all(
			requests.map(async ([host, protocol]) => {
				expect(await project(context(host, protocol))).toEqual({ notFound: true })
			})
		)
		expect(network.urls()).toEqual([])
	})

	test('does not expose standalone routes on the main site or without a host', async () => {
		const pages = await loadPages()
		await Promise.all(
			[undefined, 'defillama.com', 'www.defillama.com'].flatMap((host) =>
				Object.values(pages).map(async (page) => {
					expect(await page(context(host, 'thorchain'))).toEqual({ notFound: true })
				})
			)
		)
		expect(network.urls()).toEqual([])
	})

	test('keeps the project page when its optional server data fails', async () => {
		network.serve({
			[`${DATASETS_SERVER_URL}/emissions/thorchain-dex`]: fixtureStatus(500, { message: 'unavailable' })
		})
		const { project } = await loadPages()
		expect(await project(context('investors.defillama.com', 'thorchain'))).toEqual({
			props: { investorsSiteId: 'investors', protocol: 'thorchain', customServerData: {} }
		})
		expect(network.urls()).toEqual([`${DATASETS_SERVER_URL}/emissions/thorchain-dex`])
	})

	test('preview env enables direct IR project requests but not enterprise access', async () => {
		vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', 'true')
		const { project } = await loadPages([])
		expect(await project(context('investors.defillama.com', 'kpk'))).toEqual({
			props: { investorsSiteId: 'investors', protocol: 'kpk', customServerData: {} }
		})
		expect(await project(context('investors.defillama.com', 'uniswap'))).toEqual({
			props: {
				investorsSiteId: 'investors',
				protocol: 'uniswap',
				customServerData: { uniswapUnlocks: { emissions: null, initialTokenMarketData: null } }
			}
		})
		for (const protocol of ['kpk', 'uniswap']) {
			expect(await project(context('enterprise.defillama.com', protocol))).toEqual({ notFound: true })
		}
	})
})
