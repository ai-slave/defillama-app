import type { ParsedUrlQuery } from 'node:querystring'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import type { MultiSeriesChartSeriesConfig, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { readSelectionFromQuery } from '~/components/Select/query'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { CHART_COLORS } from '~/constants/colors'
import { formatIsoDate } from '~/utils/dateFormat'
import type { Raise } from './model'
import type { RaisesSummary } from './summary'
import { UNKNOWN_OPTION } from './utils'

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

/** Trimmed values, or Unknown when a raise has none, matching how the picker options are built. */
function valuesOrUnknown(values: Array<string>): Array<string> {
	const trimmed: Array<string> = []
	for (const value of values) {
		const name = value.trim()
		if (name) trimmed.push(name)
	}
	return trimmed.length > 0 ? trimmed : [UNKNOWN_OPTION]
}

/** The Raises page's filtered rows, breakdowns and charts for the filters in the URL query. */
export function buildRaisesData(
	{ raises, investors, rounds, sectors, chains }: UseRaisesDataParams,
	query: ParsedUrlQuery
) {
	const { minRaised, maxRaised } = query

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

	// null when every option is selected. An investor page has no investor options, so its hidden picker's
	// key selects nothing to filter.
	const pick = (includeKey: string, excludeKey: ExcludeQueryKey, options: Array<string>) => {
		const selected = readSelectionFromQuery(query, includeKey, excludeKey, options)
		return selected.length === options.length ? null : new Set(selected)
	}
	const selectedInvestorsSet = pick('investor', 'excludeInvestor', investors)
	const selectedChainsSet = pick('chain', 'excludeChain', chains)
	const selectedRoundsSet = pick('round', 'excludeRound', rounds)
	const selectedSectorsSet = pick('sector', 'excludeSector', sectors)
	const hasActiveFilters =
		selectedInvestorsSet !== null ||
		selectedChainsSet !== null ||
		selectedRoundsSet !== null ||
		selectedSectorsSet !== null ||
		isAmountRangeActive

	const filteredRaisesList: Array<Raise> = []
	let undisclosedCount = 0
	for (const raise of raises) {
		// A raise with several investors or chains stays while any of them is selected.
		if (
			selectedInvestorsSet &&
			!valuesOrUnknown([...raise.leadInvestors, ...raise.otherInvestors]).some((i) => selectedInvestorsSet.has(i))
		)
			continue
		if (selectedChainsSet && !valuesOrUnknown(raise.chains).some((c) => selectedChainsSet.has(c))) continue
		if (selectedRoundsSet && !selectedRoundsSet.has(raise.round?.trim() || UNKNOWN_OPTION)) continue
		if (selectedSectorsSet && !selectedSectorsSet.has(raise.category?.trim() || UNKNOWN_OPTION)) continue

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
		hasActiveFilters,
		filteredRaisesList,
		raisesByCategory: finalRaisesByCategory.sort((a, b) => b.value - a.value),
		investmentByRounds: finalInvestmentByRounds.sort((a, b) => b.value - a.value),
		monthlyInvestmentChart,
		fundingRoundsByMonthChart,
		totalAmountRaised,
		fundingSummary
	}
}
