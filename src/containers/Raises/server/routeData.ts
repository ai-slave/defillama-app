import { fetchRaisesFromSnapshot } from '~/containers/Raises/server/dataset.server'
import { slug } from '~/utils'

export async function getRaisesInvestorSlugsFromSnapshot(): Promise<Array<string>> {
	const { raises } = await fetchRaisesFromSnapshot()
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
