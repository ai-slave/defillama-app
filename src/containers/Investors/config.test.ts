import { afterEach, describe, expect, test, vi } from 'vitest'

async function loadConfig(preview = '') {
	vi.resetModules()
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', preview)
	return import('./config')
}

afterEach(() => vi.unstubAllEnvs())

describe('investor site configuration', () => {
	test('resolves exact hosts independently of legacy deployment overrides', async () => {
		vi.stubEnv('NEXT_PUBLIC_INVESTORS_SITE', 'enterprise')
		vi.stubEnv('NEXT_PUBLIC_SUPERLUMINAL_DASHBOARD_ID', 'legacy-dashboard')
		const { getInvestorsSite } = await loadConfig()
		expect(getInvestorsSite('INVESTORS.DEFILLAMA.COM:3000')?.id).toBe('investors')
		expect(getInvestorsSite('enterprise.defillama.com')?.id).toBe('enterprise')
		expect(getInvestorsSite('investors.defillama.com')?.id).toBe('investors')
		for (const host of [
			undefined,
			null,
			'',
			'localhost',
			'127.0.0.1',
			'[::1]:3000',
			'defillama.com',
			'www.defillama.com',
			'unknown.example',
			'investors.defillama.com.evil.com',
			'notinvestors.defillama.com',
			'https://investors.defillama.com',
			'investors.defillama.com,enterprise.defillama.com',
			'investors.defillama.com:invalid',
			'investors.defillama.com/path'
		]) {
			expect(getInvestorsSite(host)).toBeNull()
		}
	})

	test('supports explicit local hosts only in development', async () => {
		const { getInvestorsSite } = await loadConfig()
		vi.stubEnv('NODE_ENV', 'development')
		expect(getInvestorsSite('investors.localhost:3000')?.id).toBe('investors')
		expect(getInvestorsSite('enterprise.localhost:3000')?.id).toBe('enterprise')
		expect(getInvestorsSite('localhost:3000')).toBeNull()
		vi.stubEnv('NODE_ENV', 'production')
		expect(getInvestorsSite('investors.localhost:3000')).toBeNull()
		expect(getInvestorsSite('enterprise.localhost:3000')).toBeNull()
	})

	test('preserves the landing catalog, cross-site links and separate analytics', async () => {
		const { INVESTORS_SITES, getInvestorsProjects, getInvestorsLandingProjectHref } = await loadConfig()
		const { investors, enterprise } = INVESTORS_SITES
		expect(investors.projectIds).toEqual(['spark', 'sonic', 'near', 'thorchain', 'flare'])
		expect(investors.landingProjectIds).toEqual(investors.projectIds)
		expect(enterprise.projectIds).toEqual(['odyssey-ecosystem'])
		expect(enterprise.landingProjectIds).toEqual([...investors.projectIds, 'odyssey-ecosystem'])
		expect(getInvestorsProjects(investors.comingSoonProjectIds).map((p) => p.id)).toEqual(['kpk'])
		expect(enterprise.comingSoonProjectIds).toEqual([])
		for (const projectId of investors.landingProjectIds) {
			expect(getInvestorsLandingProjectHref(investors, projectId)).toBe(`/${projectId}`)
			expect(getInvestorsLandingProjectHref(enterprise, projectId)).toBe(`https://investors.defillama.com/${projectId}`)
		}
		expect(getInvestorsLandingProjectHref(enterprise, 'odyssey-ecosystem')).toBe('/odyssey-ecosystem')
		expect(investors.umamiWebsiteId).toBe('11de15eb-61d0-41c5-9e73-0bf496cc653c')
		expect(enterprise.umamiWebsiteId).toBe('1c194e22-d31d-4816-b803-8074419f1b3e')
	})

	test('keeps preview access independent of landing visibility and enterprise projects', async () => {
		const { INVESTORS_SITES, getInvestorsProject } = await loadConfig('true')
		const { investors, enterprise } = INVESTORS_SITES
		expect(investors.projectIds).toEqual(['spark', 'sonic', 'near', 'thorchain', 'flare', 'kpk', 'uniswap'])
		expect(investors.landingProjectIds).toEqual(['spark', 'sonic', 'near', 'thorchain', 'flare'])
		expect(investors.comingSoonProjectIds).toEqual(['kpk'])
		expect(enterprise.projectIds).toEqual(['odyssey-ecosystem'])
		for (const project of ['kpk', 'uniswap']) {
			expect(getInvestorsProject(investors, project)?.id).toBe(project)
			expect(getInvestorsProject(enterprise, project)).toBeUndefined()
		}
	})
})
