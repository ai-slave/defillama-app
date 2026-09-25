import type { ParsedUrlQuery } from 'node:querystring'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import type { MultiSeriesChartSeriesConfig, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { formatIsoDate } from '~/utils/dateFormat'
import { parseExcludeParam } from '~/utils/routerQuery'
import type { Raise } from './model'
import type { RaisesSummary } from './summary'

interface UseRaisesDataParams {
	raises: Array<Raise>
	investors: Array<string>
	rounds: Array<string>
	sectors: Array<string>
	chains: Array<string>
}

export function useRaisesData({ raises, investors, rounds, sectors, chains }: UseRaisesDataParams) {
	const { query } = useRouter()

	const {
		investor,
		excludeInvestor,
		round,
		excludeRound,
		sector,
		excludeSector,
		chain,
		excludeChain,
		minRaised,
		maxRaised
	} = query

	return useMemo(
		() =>
			buildRaisesData(
				{ raises, investors, rounds, sectors, chains },
				{
					investor,
					excludeInvestor,
					round,
					excludeRound,
					sector,
					excludeSector,
					chain,
					excludeChain,
					minRaised,
					maxRaised
				}
			),
		[
			investor,
			excludeInvestor,
			investors,
			round,
			excludeRound,
			rounds,
			sector,
			excludeSector,
			sectors,
			chain,
			excludeChain,
			chains,
			raises,
			minRaised,
			maxRaised
		]
	)
}

/** The Raises page's filtered rows, breakdowns and charts for the filters in the URL query. */
export function buildRaisesData(
	{ raises, investors, rounds, sectors, chains }: UseRaisesDataParams,
	query: ParsedUrlQuery
) {
	const {
		investor,
		excludeInvestor,
		round,
		excludeRound,
		sector,
		excludeSector,
		chain,
		excludeChain,
		minRaised,
		maxRaised
	} = query

	// Parse exclude sets upfront
	// Note: For investors and chains, we need separate exclude sets because we're checking
	// "exclude if ANY item in array matches", which can't be combined with the selection logic
	const excludeInvestorsSet = parseExcludeParam(excludeInvestor)
	const excludeChainsSet = parseExcludeParam(excludeChain)
	const excludeRoundsSet = parseExcludeParam(excludeRound)
	const excludeSectorsSet = parseExcludeParam(excludeSector)

	// Build selectedInvestors
	let selectedInvestors: Array<string>
	if (investor) {
		if (typeof investor === 'string') {
			selectedInvestors = investor === 'All' ? [...investors] : investor === 'None' ? [] : [investor]
		} else {
			selectedInvestors = [...investor]
		}
	} else {
		selectedInvestors = [...investors]
	}
	// Filter out excludes from selectedInvestors
	selectedInvestors =
		excludeInvestorsSet.size > 0 ? selectedInvestors.filter((i) => !excludeInvestorsSet.has(i)) : selectedInvestors

	// Build selectedRounds and filter out excludes inline
	let selectedRounds: Array<string>
	if (round) {
		if (typeof round === 'string') {
			selectedRounds = round === 'All' ? [...rounds] : round === 'None' ? [] : [round]
		} else {
			selectedRounds = [...round]
		}
	} else {
		selectedRounds = [...rounds]
	}
	selectedRounds = excludeRoundsSet.size > 0 ? selectedRounds.filter((r) => !excludeRoundsSet.has(r)) : selectedRounds

	// Build selectedSectors and filter out excludes inline
	let selectedSectors: Array<string>
	if (sector) {
		if (typeof sector === 'string') {
			selectedSectors = sector === 'All' ? [...sectors] : sector === 'None' ? [] : [sector]
		} else {
			selectedSectors = [...sector]
		}
	} else {
		selectedSectors = [...sectors]
	}
	selectedSectors =
		excludeSectorsSet.size > 0 ? selectedSectors.filter((s) => !excludeSectorsSet.has(s)) : selectedSectors

	// Build selectedChains
	let selectedChains: Array<string>
	if (chain) {
		if (typeof chain === 'string') {
			selectedChains = chain === 'All' ? [...chains] : chain === 'None' ? [] : [chain]
		} else {
			selectedChains = [...chain]
		}
	} else {
		selectedChains = [...chains]
	}
	// Filter out excludes from selectedChains
	selectedChains = excludeChainsSet.size > 0 ? selectedChains.filter((c) => !excludeChainsSet.has(c)) : selectedChains

	const raisesByCategory: { [category: string]: number } = {}
	const fundingRoundsByMonth: Record<string, number> = {}
	const monthlyInvestment: Record<string, number> = {}
	const investmentByRounds: { [round: string]: number } = {}

	const minimumAmountRaised =
		typeof minRaised === 'string' && minRaised.trim() !== '' && Number.isFinite(Number(minRaised))
			? Number(minRaised)
			: null

	const maximumAmountRaised =
		typeof maxRaised === 'string' && maxRaised.trim() !== '' && Number.isFinite(Number(maxRaised))
			? Number(maxRaised)
			: null

	const isAmountRangeActive = minimumAmountRaised !== null || maximumAmountRaised !== null

	const isInvestorFilterActive = selectedInvestors.length !== investors.length
	const isChainsFilterActive = selectedChains.length !== chains.length
	const isRoundsFilterActive = selectedRounds.length !== rounds.length
	const isSectorsFilterActive = selectedSectors.length !== sectors.length

	const selectedInvestorsSet = isInvestorFilterActive ? new Set(selectedInvestors) : null
	const selectedChainsSet = isChainsFilterActive ? new Set(selectedChains) : null
	const selectedRoundsSet = isRoundsFilterActive ? new Set(selectedRounds) : null
	const selectedSectorsSet = isSectorsFilterActive ? new Set(selectedSectors) : null

	const filteredRaisesList: Array<Raise> = []
	let undisclosedCount = 0
	for (const raise of raises) {
		if (selectedInvestorsSet) {
			if (raise.leadInvestors.length === 0 && raise.otherInvestors.length === 0) {
				continue
			}

			let isAnInvestor = false

			for (const lead of raise.leadInvestors) {
				if (selectedInvestorsSet.has(lead)) {
					isAnInvestor = true
					break
				}
			}

			if (!isAnInvestor) {
				for (const otherInv of raise.otherInvestors) {
					if (selectedInvestorsSet.has(otherInv)) {
						isAnInvestor = true
						break
					}
				}
			}

			if (!isAnInvestor) {
				continue
			}
		}

		if (selectedChainsSet) {
			if (raise.chains.length === 0) {
				continue
			}

			let raiseIncludesChain = false

			for (const raiseChain of raise.chains) {
				if (selectedChainsSet.has(raiseChain)) {
					raiseIncludesChain = true
					break
				}
			}

			if (!raiseIncludesChain) {
				continue
			}
		}

		if (selectedRoundsSet && (!raise.round || !selectedRoundsSet.has(raise.round))) continue
		if (selectedSectorsSet && (!raise.category || !selectedSectorsSet.has(raise.category))) continue

		if (isAmountRangeActive) {
			if (raise.amountUsd === null) continue
			if (minimumAmountRaised !== null && raise.amountUsd < minimumAmountRaised) continue
			if (maximumAmountRaised !== null && raise.amountUsd > maximumAmountRaised) continue
		}

		if (raise.category) {
			raisesByCategory[raise.category] = (raisesByCategory[raise.category] ?? 0) + 1
		}

		filteredRaisesList.push(raise)
		if (raise.amountUsd === null) undisclosedCount++
		// split EOS raised amount between 13 months
		if (raise.name === 'EOS') {
			for (let month = 0; month < 13; month++) {
				const date = formatIsoDate(raise.date - month * 2_529_746, { input: 'seconds' })?.slice(0, 7)
				if (!date) continue
				monthlyInvestment[date] = (monthlyInvestment[date] ?? 0) + (raise.amountUsd ?? 0) / 13
				fundingRoundsByMonth[date] = (fundingRoundsByMonth[date] ?? 0) + 1
			}
		} else {
			const monthlyDate = formatIsoDate(raise.date, { input: 'seconds' })?.slice(0, 7)
			if (!monthlyDate) continue

			monthlyInvestment[monthlyDate] = (monthlyInvestment[monthlyDate] ?? 0) + (raise.amountUsd ?? 0)
			fundingRoundsByMonth[monthlyDate] = (fundingRoundsByMonth[monthlyDate] ?? 0) + 1
		}

		if (raise.round) {
			investmentByRounds[raise.round] = (investmentByRounds[raise.round] ?? 0) + 1
		}
	}

	const finalMonthlyInvestment: Array<[number, number]> = []
	const finalRaisesByCategory = []
	const finalInvestmentByRounds = []
	const finalFundingRoundsByMonth: Array<[number, number]> = []
	let totalAmountRaised = 0

	// These loops enumerate only buckets initialized in the row pass above.
	for (const date in monthlyInvestment) {
		const amount = monthlyInvestment[date]!
		finalMonthlyInvestment.push([new Date(date).getTime(), amount])
		totalAmountRaised += amount
	}
	// ECharts `dataZoom` (slider shadow) is sensitive to source order.
	// We build these series from object keys, which are not guaranteed to be chronological.
	finalMonthlyInvestment.sort((a, b) => a[0] - b[0])
	for (const category in raisesByCategory) {
		finalRaisesByCategory.push({ name: category, value: raisesByCategory[category]! })
	}
	for (const roundLabel in investmentByRounds) {
		finalInvestmentByRounds.push({ name: roundLabel, value: investmentByRounds[roundLabel]! })
	}
	for (const date in fundingRoundsByMonth) {
		finalFundingRoundsByMonth.push([new Date(date).getTime(), fundingRoundsByMonth[date]!])
	}
	finalFundingRoundsByMonth.sort((a, b) => a[0] - b[0])

	const monthlyInvestmentChart: { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> } = {
		dataset: {
			source: finalMonthlyInvestment,
			dimensions: ['timestamp', 'Funding Amount']
		},
		charts: [
			{
				type: 'bar',
				name: 'Funding Amount',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0],
				stack: 'Funding Amount'
			}
		]
	}

	const fundingRoundsByMonthChart: { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> } = {
		dataset: {
			source: finalFundingRoundsByMonth,
			dimensions: ['timestamp', 'Funding Rounds']
		},
		charts: [
			{
				type: 'bar',
				name: 'Funding Rounds',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0],
				stack: 'Funding Rounds'
			}
		]
	}

	const fundingSummary: RaisesSummary = {
		totalUsd:
			filteredRaisesList.length > 0 && undisclosedCount === filteredRaisesList.length ? null : totalAmountRaised,
		undisclosedCount
	}
	return {
		selectedInvestors,
		selectedChains,
		selectedRounds,
		selectedSectors,
		filteredRaisesList,
		raisesByCategory: finalRaisesByCategory.sort((a, b) => b.value - a.value),
		investmentByRounds: finalInvestmentByRounds.sort((a, b) => b.value - a.value),
		monthlyInvestmentChart,
		fundingRoundsByMonthChart,
		totalAmountRaised,
		fundingSummary
	}
}
