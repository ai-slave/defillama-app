import type { GetServerSidePropsContext } from 'next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchCustomServerData } = vi.hoisted(() => ({ fetchCustomServerData: vi.fn() }))
vi.mock('../serverDataRegistry', () => ({ fetchCustomServerData }))
vi.mock('~/components/SEO', () => ({ SEO: () => null }))
vi.mock('~/components/Toast', () => ({ Toast: () => null }))
vi.mock('~/components/Nav/ThemeSwitch', () => ({ ThemeSwitch: () => null }))

function context(host: string | undefined, protocol?: string): GetServerSidePropsContext {
	return {
		req: { headers: { host } },
		res: {},
		params: protocol ? { protocol } : {},
		query: {},
		resolvedUrl: protocol ? `/investors/${protocol}` : '/investors'
	} as GetServerSidePropsContext
}

async function loadPages() {
	const [landing, all, project] = await Promise.all([
		import('~/pages/investors'),
		import('~/pages/investors/all'),
		import('~/pages/investors/[protocol]')
	])
	return { landing: landing.getServerSideProps, all: all.getServerSideProps, project: project.getServerSideProps }
}

beforeEach(() => {
	vi.resetModules()
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_SITE', '')
	vi.stubEnv('NEXT_PUBLIC_SUPERLUMINAL_DASHBOARD_ID', '')
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', '')
	fetchCustomServerData.mockReset().mockImplementation(async (dashboardId: string) => ({ [dashboardId]: 'data' }))
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
		expect(fetchCustomServerData).not.toHaveBeenCalled()
	})

	test('isolates overlapping project requests in the same imported pages', async () => {
		const { project } = await loadPages()
		let resolveSpark!: (value: Record<string, unknown>) => void
		fetchCustomServerData.mockImplementation((id: string) =>
			id === '9vn8xp43tdzo6gt'
				? new Promise((resolve) => {
						resolveSpark = resolve
					})
				: Promise.resolve({ odyssey: true })
		)
		const spark = project(context('investors.defillama.com', 'spark'))
		expect(await project(context('enterprise.defillama.com', 'odyssey-ecosystem'))).toEqual({
			props: { investorsSiteId: 'enterprise', protocol: 'odyssey-ecosystem', customServerData: { odyssey: true } }
		})
		resolveSpark({ spark: true })
		expect(await spark).toEqual({
			props: { investorsSiteId: 'investors', protocol: 'spark', customServerData: { spark: true } }
		})
	})

	test('returns real 404s before fetching data for direct unavailable project requests', async () => {
		const { project } = await loadPages()
		const requests = [
			['investors.defillama.com', 'odyssey-ecosystem'],
			['enterprise.defillama.com', 'spark'],
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
		expect(fetchCustomServerData).not.toHaveBeenCalled()
	})

	test('does not expose standalone routes on the main site or an unrecognized host', async () => {
		const pages = await loadPages()
		await Promise.all(
			[undefined, 'defillama.com', 'www.defillama.com', 'unknown.example'].flatMap((host) =>
				Object.values(pages).map(async (page) => {
					expect(await page(context(host, 'spark'))).toEqual({ notFound: true })
				})
			)
		)
		expect(fetchCustomServerData).not.toHaveBeenCalled()
	})

	test('loads only investor projects for all, and retains site identity if optional data fails', async () => {
		const { all, project } = await loadPages()
		const result = await all(context('investors.defillama.com'))
		expect(result).toMatchObject({ props: { investorsSiteId: 'investors' } })
		expect(fetchCustomServerData.mock.calls.map(([id]) => id)).toEqual([
			'9vn8xp43tdzo6gt',
			's0n1cd4shb0ard1',
			'n34rr3v3nu3d4sh',
			'bfqwxro9m0xnc9z',
			'fl4r3d4shb0ard1'
		])
		fetchCustomServerData.mockRejectedValue(new Error('optional source unavailable'))
		expect(await project(context('enterprise.defillama.com', 'odyssey-ecosystem'))).toEqual({
			props: { investorsSiteId: 'enterprise', protocol: 'odyssey-ecosystem', customServerData: {} }
		})
	})

	test('preview env enables direct IR project requests but not enterprise access', async () => {
		vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', 'true')
		const { project } = await loadPages()
		await Promise.all(
			['kpk', 'uniswap'].map(async (protocol) => {
				expect(await project(context('investors.defillama.com', protocol))).toMatchObject({
					props: { investorsSiteId: 'investors', protocol }
				})
				expect(await project(context('enterprise.defillama.com', protocol))).toEqual({ notFound: true })
			})
		)
	})
})
