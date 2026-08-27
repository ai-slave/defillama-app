import { slug } from '~/utils'
import { fetchRaises } from './api'
import type { Raise } from './model'
import type {
	IInvestor,
	IInvestorRaisesPageData,
	IInvestorsPageData,
	IInvestorTimespan,
	IRaisesPageData
} from './types'
import { getRaisesFiltersList } from './utils'

type InvestorDealsAccumulatorTimespan = {
	topCategory: string | null
	topRound: string | null
	topAmount: number
	amounts: number[]
	projects: Set<string>
	chains: Set<string>
	deals: number
}

type InvestorDealsAccumulator = {
	name: string
	last30d: InvestorDealsAccumulatorTimespan
	last180d: InvestorDealsAccumulatorTimespan
	last1y: InvestorDealsAccumulatorTimespan
	allTime: InvestorDealsAccumulatorTimespan
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const LAST_30_DAYS_IN_MS = 30 * DAY_IN_MS
const LAST_180_DAYS_IN_MS = 180 * DAY_IN_MS
const LAST_1Y_IN_MS = 365 * DAY_IN_MS

function calculateMedian(amounts: number[]): number | null {
	if (amounts.length === 0) return null

	// The accumulator owns this array and is finished when the median is calculated.
	const sorted = amounts.sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)

	// A nonempty sorted array contains middle; an even nonempty array also contains middle - 1.
	return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

function createEmptyTimespan(): InvestorDealsAccumulatorTimespan {
	return {
		topCategory: null,
		topRound: null,
		topAmount: 0,
		amounts: [],
		projects: new Set(),
		chains: new Set(),
		deals: 0
	}
}

function createInvestorDealsAccumulator(name: string): InvestorDealsAccumulator {
	return {
		name,
		last30d: createEmptyTimespan(),
		last180d: createEmptyTimespan(),
		last1y: createEmptyTimespan(),
		allTime: createEmptyTimespan()
	}
}

function updateTimespan(timespan: InvestorDealsAccumulatorTimespan, raise: Raise) {
	timespan.deals += 1
	timespan.projects.add(raise.name)
	for (const chain of raise.chains) {
		timespan.chains.add(chain)
	}

	if (raise.amountUsd != null) {
		timespan.amounts.push(raise.amountUsd)
		// "Top" fields track the single largest deal amount in the timespan.
		if (raise.amountUsd > timespan.topAmount) {
			timespan.topCategory = raise.category
			timespan.topRound = raise.round
			timespan.topAmount = raise.amountUsd
		}
	}
}

function normalizeTimespan(timespan: InvestorDealsAccumulatorTimespan): IInvestorTimespan {
	return {
		topCategory: timespan.topCategory,
		topRound: timespan.topRound,
		deals: timespan.deals,
		projects: Array.from(timespan.projects).join(', '),
		chains: Array.from(timespan.chains),
		medianAmountUsd: calculateMedian(timespan.amounts)
	}
}

export async function getRaisesPageData(): Promise<IRaisesPageData> {
	const data = await fetchRaises()
	const filters = getRaisesFiltersList({ raises: data.raises })

	return {
		raises: data.raises,
		...filters,
		investorName: null
	}
}

export async function getInvestorRaisesPageData(
	investorSlug: string
): Promise<IInvestorRaisesPageData | { notFound: true }> {
	const data = await fetchRaises()

	const raises: Raise[] = []
	let investorName: string | null = null

	for (const raise of data.raises) {
		let isInvestor = false

		for (const leadInvestor of raise.leadInvestors) {
			if (slug(leadInvestor.toLowerCase()) === investorSlug) {
				investorName = leadInvestor
				isInvestor = true
			}
		}

		for (const otherInvestor of raise.otherInvestors) {
			if (slug(otherInvestor.toLowerCase()) === investorSlug) {
				investorName = otherInvestor
				isInvestor = true
			}
		}

		if (isInvestor) {
			raises.push(raise)
		}
	}

	if (investorName === null) {
		return {
			notFound: true
		}
	}

	const filters = getRaisesFiltersList({ raises: data.raises, investorName })

	return {
		raises,
		...filters,
		investorName
	}
}

export async function getInvestorsPageData(): Promise<IInvestorsPageData> {
	const data = await fetchRaises()
	const dealsByInvestor: Record<string, InvestorDealsAccumulator> = {}
	const now = Date.now()

	for (const raise of data.raises) {
		const raiseDateMs = raise.date * 1000

		const investors = new Set(raise.leadInvestors)
		for (const investor of raise.otherInvestors) investors.add(investor)

		for (const investorName of investors) {
			dealsByInvestor[investorName] = dealsByInvestor[investorName] ?? createInvestorDealsAccumulator(investorName)
			const investorDeals = dealsByInvestor[investorName]

			if (raiseDateMs >= now - LAST_30_DAYS_IN_MS) {
				updateTimespan(investorDeals.last30d, raise)
			}
			if (raiseDateMs >= now - LAST_180_DAYS_IN_MS) {
				updateTimespan(investorDeals.last180d, raise)
			}
			if (raiseDateMs >= now - LAST_1Y_IN_MS) {
				updateTimespan(investorDeals.last1y, raise)
			}
			updateTimespan(investorDeals.allTime, raise)
		}
	}

	const investors: IInvestor[] = []
	for (const name in dealsByInvestor) {
		// Every enumerated entry is initialized in the accumulation pass above.
		const investor = dealsByInvestor[name]!
		investors.push({
			name: investor.name,
			last30d: normalizeTimespan(investor.last30d),
			last180d: normalizeTimespan(investor.last180d),
			last1y: normalizeTimespan(investor.last1y),
			allTime: normalizeTimespan(investor.allTime)
		})
	}

	return { investors }
}
