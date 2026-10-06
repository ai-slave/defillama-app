import { getRaisesInvestorSlugsFromSnapshot } from './routeData'

export async function getRaisesSitemapRoutes(): Promise<Array<string>> {
	const investorSlugs = await getRaisesInvestorSlugsFromSnapshot()
	const routes: Array<string> = []
	for (const investorSlug of investorSlugs) {
		routes.push(`raises/${investorSlug}`)
	}
	return routes
}
