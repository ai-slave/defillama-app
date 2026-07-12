import { fetchRaises } from '~/containers/Raises/server/dataset.server'
import { slug } from '~/utils'

export async function getRaisesInvestorSlugsFromSnapshot(): Promise<string[]> {
	const { raises } = await fetchRaises()
	const investorSlugs = new Set<string>()

	for (const raise of raises) {
		for (const investor of raise.leadInvestors ?? []) {
			investorSlugs.add(slug(investor))
		}
		for (const investor of raise.otherInvestors ?? []) {
			investorSlugs.add(slug(investor))
		}
	}

	return [...investorSlugs]
}
