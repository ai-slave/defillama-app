import { slug } from '~/utils'
import type { Raise } from './model'
import type { IRaisesFilters } from './types'

type RaiseFilterItem = Pick<Raise, 'leadInvestors' | 'otherInvestors' | 'round' | 'category' | 'chains' | 'amountUsd'>

type GetRaisesFiltersListArgs = {
	raises: Array<RaiseFilterItem>
	investorName?: string | null
}

const addAmount = (map: Map<string, number>, key: string, amount: number) => {
	map.set(key, (map.get(key) ?? 0) + amount)
}

const sortByAmountThenName = (values: Array<string>, amounts: Map<string, number>) => {
	return values.sort((a, b) => {
		const diff = (amounts.get(b) ?? 0) - (amounts.get(a) ?? 0)
		if (diff !== 0) return diff
		return a.localeCompare(b)
	})
}

/** The picker option for raises without an investor, round, sector or chain, so users can keep or drop them. */
export const UNKNOWN_OPTION = 'Unknown'

const withUnknown = (names: Array<string>, hasMissing: boolean): Array<string> =>
	hasMissing ? [...names, UNKNOWN_OPTION] : names

export function getRaisesFiltersList({ raises, investorName }: GetRaisesFiltersListArgs): IRaisesFilters {
	if (raises.length === 0)
		return {
			investors: [],
			rounds: [],
			sectors: [],
			chains: []
		}

	const investorSlug = investorName ? slug(investorName.trim().toLowerCase()) : null

	const investors = new Set<string>()
	const rounds = new Set<string>()
	const sectors = new Set<string>()
	const chains = new Set<string>()

	const investorAmounts = new Map<string, number>()
	const roundAmounts = new Map<string, number>()
	const sectorAmounts = new Map<string, number>()
	const chainAmounts = new Map<string, number>()
	let missingInvestor = false
	let missingRound = false
	let missingSector = false
	let missingChain = false

	for (const raise of raises) {
		const includeRaise =
			!investorSlug ||
			[...raise.leadInvestors, ...raise.otherInvestors].some((inv) => {
				if (!inv) return false
				return slug(inv.trim().toLowerCase()) === investorSlug
			})

		if (!includeRaise) continue

		const amount = raise.amountUsd ?? 0

		// Only build investors list for the "all raises" page.
		if (!investorSlug) {
			if (raise.leadInvestors.length === 0 && raise.otherInvestors.length === 0) missingInvestor = true
			for (const leadInvestor of raise.leadInvestors) {
				const investor = leadInvestor.trim()
				investors.add(investor)
				addAmount(investorAmounts, investor, amount)
			}

			for (const otherInvestor of raise.otherInvestors) {
				const investor = otherInvestor.trim()
				investors.add(investor)
				addAmount(investorAmounts, investor, amount)
			}
		}

		if (!raise.round) missingRound = true
		if (!raise.category) missingSector = true
		if (!raise.chains.some((chain) => chain.trim())) missingChain = true

		if (raise.round) {
			const round = raise.round.trim()
			rounds.add(round)
			addAmount(roundAmounts, round, amount)
		}

		if (raise.category) {
			const sector = raise.category.trim()
			sectors.add(sector)
			addAmount(sectorAmounts, sector, amount)
		}

		for (const chain of raise.chains) {
			const c = chain.trim()
			if (!c) continue
			chains.add(c)
			addAmount(chainAmounts, c, amount)
		}
	}

	return {
		investors: investorSlug
			? []
			: withUnknown(sortByAmountThenName(Array.from(investors), investorAmounts), missingInvestor),
		rounds: withUnknown(sortByAmountThenName(Array.from(rounds), roundAmounts), missingRound),
		sectors: withUnknown(sortByAmountThenName(Array.from(sectors), sectorAmounts), missingSector),
		chains: withUnknown(sortByAmountThenName(Array.from(chains), chainAmounts), missingChain)
	}
}
