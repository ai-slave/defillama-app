import { getRaisesInvestorSlugsFromSnapshot } from './routeData'

export async function getRaisesInvestorRoutes(): Promise<string[]> {
	const investorSlugs = await getRaisesInvestorSlugsFromSnapshot()
	const routes: string[] = []
	for (const investorSlug of investorSlugs) {
		routes.push(`raises/${investorSlug}`)
	}
	return routes
}

export const getRaisesSitemapRoutes = getRaisesInvestorRoutes
