import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { fetchProtocolBySlug } from './api'
import type { IProtocolChainTvlEntry, IProtocolOverviewMetricsV1 } from './api.types'

type ChainTvlEntry = IProtocolChainTvlEntry
type ChainTvls = Record<string, ChainTvlEntry>
type AccumulatedValueRow = Map<string, number>
type AccumulatedValueDirectory = Map<number, AccumulatedValueRow>

export const MAX_PROTOCOL_V1_BREAKDOWN_SERIES = 30
const OTHERS_SERIES_NAME = 'Others'

export type ProtocolV1AddlChartsData = {
	tokensUnique?: string[]
	rawTokensUnique?: string[]
	tokenBreakdownUSDDataset?: TimestampDataset
	tokenBreakdownPieChart?: Array<{ name: string; value: number }>
	tokenBreakdownDataset?: TimestampDataset
	usdInflowsDataset?: TimestampDataset | null
	tokenInflowsDataset?: TimestampDataset | null
}

function getSortedDates(directory: Map<number, unknown>): number[] {
	return Array.from(directory.keys()).sort((a, b) => a - b)
}

function buildTimestampDataset(
	directory: AccumulatedValueDirectory,
	seriesNames: string[],
	sortedDates = getSortedDates(directory)
): TimestampDataset {
	const source = new Array<TimestampDataset['source'][number]>(sortedDates.length)
	for (let i = 0; i < sortedDates.length; i++) {
		const date = sortedDates[i]
		const values = directory.get(date)!
		const nextRow = new Array<number | undefined>(seriesNames.length + 1)
		nextRow[0] = date * 1e3
		for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
			nextRow[seriesIndex + 1] = values.get(seriesNames[seriesIndex])
		}
		source[i] = nextRow
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

export function buildProtocolV1ChartConfigs({
	seriesNames,
	type,
	colors,
	stack,
	hideAreaStyle = false
}: {
	seriesNames: string[]
	type: MultiSeriesChartSeriesConfig['type']
	colors?: Record<string, string>
	stack?: string
	hideAreaStyle?: boolean
}): MultiSeriesChartSeriesConfig[] {
	const charts = new Array<MultiSeriesChartSeriesConfig>(seriesNames.length)
	for (let i = 0; i < seriesNames.length; i++) {
		const name = seriesNames[i]
		charts[i] = {
			type,
			name,
			encode: { x: 0, y: i + 1 },
			...(colors?.[name] ? { color: colors[name] } : {}),
			...(stack ? { stack } : {}),
			...(type === 'line' && hideAreaStyle ? { hideAreaStyle: true } : {})
		}
	}
	return charts
}

export const formatProtocolV1TvlsByChain = ({
	historicalChainTvls,
	extraTvlsEnabled
}: {
	historicalChainTvls: ChainTvls
	extraTvlsEnabled: Record<string, boolean>
}) => {
	const tvlDictionary: AccumulatedValueDirectory = new Map()

	for (const section in historicalChainTvls) {
		let sectionName = section
		const name = section.toLowerCase()

		let toSumSection = false

		// sum keys like ethereum-staking, arbitrum-vesting only if chain is present
		if (name.includes('-')) {
			const formattedName = name.split('-')

			if (extraTvlsEnabled[formattedName[1]]) {
				toSumSection = true

				sectionName = section.split('-').slice(0, -1).join('-')
			}
		} else {
			// sum key with staking, ethereum, arbitrum etc but ethereum-staking, arbitrum-vesting
			if (extraTvlsEnabled[name] == null) {
				toSumSection = true
			}
		}

		if (toSumSection) {
			const tvl = historicalChainTvls[section].tvl
			if (tvl) {
				for (const { date, totalLiquidityUSD } of tvl) {
					let values = tvlDictionary.get(date)
					if (!values) {
						values = new Map()
						tvlDictionary.set(date, values)
					}

					values.set(sectionName, (values.get(sectionName) ?? 0) + totalLiquidityUSD)
				}
			}
		}
	}

	const dates = getSortedDates(tvlDictionary)
	const lastEntry = dates.length > 0 ? tvlDictionary.get(dates[dates.length - 1]) : undefined
	const chainsUnique = lastEntry ? Array.from(lastEntry.keys()) : []

	return { dataset: buildTimestampDataset(tvlDictionary, chainsUnique, dates), chainsUnique }
}

function buildProtocolV1Inflows({
	chainTvls,
	extraTvlsEnabled,
	tokensUnique,
	datesToDelete,
	tokenToExclude
}: {
	chainTvls: ChainTvls
	extraTvlsEnabled: Record<string, boolean>
	tokensUnique: string[]
	datesToDelete: number[]
	tokenToExclude?: string | null
}) {
	const usdInflows = new Map<number, number>()
	const tokenInflows: AccumulatedValueDirectory = new Map()
	const tokensUniqueSet = new Set(tokensUnique)

	let zeroUsdInfows = 0
	let zeroTokenInfows = 0

	for (const section in chainTvls) {
		const name = section.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (name.includes('-')) continue

		const isEnabled = extraTvlsEnabled[name] ?? true
		if (!isEnabled) continue

		// Index per-date maps
		const tokensInUsdByDate = new Map<number, Record<string, number>>()
		const tokensByDate = new Map<number, Record<string, number>>()
		const dateSet = new Set<number>()

		for (const { date, tokens } of chainTvls[section]?.tokensInUsd ?? []) {
			tokensInUsdByDate.set(date, tokens)
			dateSet.add(date)
		}
		for (const { date, tokens } of chainTvls[section]?.tokens ?? []) {
			tokensByDate.set(date, tokens)
			dateSet.add(date)
		}

		const dates = Array.from(dateSet).sort((a, b) => a - b)

		for (let i = 1; i < dates.length; i++) {
			const currentDate = dates[i]
			const prevDate = dates[i - 1]

			const currentTokens = tokensByDate.get(currentDate) ?? {}
			const oldTokens = tokensByDate.get(prevDate) ?? {}
			const currentUsdTokens = tokensInUsdByDate.get(currentDate) ?? {}
			const oldUsdTokens = tokensInUsdByDate.get(prevDate) ?? {}

			// Build price map using larger totalUSD preference
			const priceMap = new Map<string, { value: number; totalUSD: number }>()
			for (const token in currentUsdTokens) {
				const amount = currentTokens[token]
				const usd = currentUsdTokens[token]
				if (amount && amount > 0) {
					priceMap.set(token, { value: usd / amount, totalUSD: usd })
				}
			}
			for (const token in oldUsdTokens) {
				const amount = oldTokens[token]
				const usd = oldUsdTokens[token]
				if (amount && amount > 0) {
					const currentPrice = priceMap.get(token)
					if (!currentPrice || currentPrice.totalUSD < usd) {
						priceMap.set(token, { value: usd / amount, totalUSD: usd })
					}
				}
			}

			let dayDifference = 0
			let selectedTokenDifference = 0
			const tokenDayDifference = new Map<string, number>()

			const addTokenDifference = (token: string) => {
				// Skip excluded token
				if (tokenToExclude && token === tokenToExclude) return

				const currentAmount = currentTokens[token] ?? 0
				const prevAmount = oldTokens[token] ?? 0
				const diff = currentAmount - prevAmount
				if (diff === 0) return

				let priceInfo = priceMap.get(token)
				if (!priceInfo) {
					// Fallback price from whichever side has info
					const currentUsdValue = currentUsdTokens[token]
					const previousUsdValue = oldUsdTokens[token]
					if (currentAmount > 0 && currentUsdValue != null) {
						priceInfo = {
							value: currentUsdValue / currentAmount,
							totalUSD: currentUsdValue
						}
					} else if (prevAmount > 0 && previousUsdValue != null) {
						priceInfo = {
							value: previousUsdValue / prevAmount,
							totalUSD: previousUsdValue
						}
					}
				}

				if (!priceInfo || !isFinite(priceInfo.value)) return

				const diffUsd = diff * priceInfo.value
				// Ignore outliers similar to computeInflowsData
				if (Math.abs(diffUsd) > 2 * (priceInfo.totalUSD || 0)) return

				dayDifference += diffUsd

				// Track token inflows only for tokens in tokensUnique
				if (tokensUniqueSet.has(token)) {
					tokenDayDifference.set(token, (tokenDayDifference.get(token) ?? 0) + diffUsd)
					selectedTokenDifference += diffUsd
				}
			}

			for (const token in currentTokens) {
				addTokenDifference(token)
			}
			for (const token in oldTokens) {
				if (currentTokens[token] == null) addTokenDifference(token)
			}

			if (tokensUniqueSet.has(OTHERS_SERIES_NAME)) {
				const othersDifference = dayDifference - selectedTokenDifference
				if (othersDifference !== 0) {
					tokenDayDifference.set(
						OTHERS_SERIES_NAME,
						(tokenDayDifference.get(OTHERS_SERIES_NAME) ?? 0) + othersDifference
					)
				}
			}

			if (dayDifference === 0) {
				zeroUsdInfows++
			}

			if (tokenDayDifference.size === 0) {
				zeroTokenInfows++
			}

			usdInflows.set(currentDate, (usdInflows.get(currentDate) ?? 0) + dayDifference)

			let accumulatedTokenInflows = tokenInflows.get(currentDate)
			if (!accumulatedTokenInflows) {
				accumulatedTokenInflows = new Map()
				tokenInflows.set(currentDate, accumulatedTokenInflows)
			}
			// Merge existing values accumulated from other chains before writing
			for (const [token, value] of accumulatedTokenInflows) {
				tokenDayDifference.set(token, (tokenDayDifference.get(token) ?? 0) + value)
			}
			for (const [token, value] of tokenDayDifference) {
				accumulatedTokenInflows.set(token, value)
			}
		}
	}

	for (const date of datesToDelete) {
		usdInflows.delete(date)
		tokenInflows.delete(date)
	}

	const usdFlowRows: AccumulatedValueDirectory = new Map()
	for (const [date, value] of usdInflows) {
		usdFlowRows.set(date, new Map([['USD Inflows', value]]))
	}
	const usdFlowDates = getSortedDates(usdFlowRows)
	const tokenFlowDates = getSortedDates(tokenInflows)

	return {
		usdInflowsDataset:
			zeroUsdInfows === usdFlowDates.length ? null : buildTimestampDataset(usdFlowRows, ['USD Inflows'], usdFlowDates),
		tokenInflowsDataset:
			zeroTokenInfows === tokenFlowDates.length
				? null
				: buildTimestampDataset(tokenInflows, tokensUnique, tokenFlowDates)
	}
}

// Helper: get top 10 non-UNKNOWN, non-near-zero tokens by absolute value.
// Returns [topTokens, totalTokenCount]
function getTop10Tokens(tokens: Record<string, number>): [Array<[string, number]>, number] {
	const topTokens: Array<[string, number]> = []
	let totalCount = 0

	for (const token in tokens) {
		totalCount++
		const value = tokens[token]
		if (token.startsWith('UNKNOWN') || value < 1) continue

		const absoluteValue = Math.abs(value)
		let insertAt = topTokens.length
		while (insertAt > 0 && absoluteValue > Math.abs(topTokens[insertAt - 1][1])) insertAt--

		if (insertAt < 10) {
			topTokens.splice(insertAt, 0, [token, value])
			if (topTokens.length > 10) topTokens.pop()
		}
	}

	return [topTokens, totalCount]
}

// Helper: accumulate per-token USD flows between consecutive dates into `tokenFlows`.
function accumulateTokenFlows({
	tokensInUsd,
	tokens,
	tokenFlows
}: {
	tokensInUsd: Array<{ date: number; tokens: Record<string, number> }>
	tokens: Array<{ date: number; tokens: Record<string, number> }>
	tokenFlows: Map<string, number>
}) {
	if (tokensInUsd.length === 0 || tokens.length === 0) return

	const tokensInUsdMap = new Map<number, Record<string, number>>()
	const tokensMap = new Map<number, Record<string, number>>()

	for (const { date, tokens: tokenData } of tokensInUsd) {
		tokensInUsdMap.set(date, tokenData)
	}

	for (const { date, tokens: tokenData } of tokens) {
		tokensMap.set(date, tokenData)
	}

	// Process dates in order (assuming arrays are already sorted by date)
	const dates = tokensInUsd.map(({ date }) => date)
	if (dates.length <= 1) return

	let prevDate: number | null = null
	for (const date of dates) {
		if (prevDate === null) {
			prevDate = date
			continue
		}

		const currTokensUsd = tokensInUsdMap.get(date)
		const currTokens = tokensMap.get(date)
		const prevTokens = tokensMap.get(prevDate)

		if (!currTokensUsd || !currTokens || !prevTokens) {
			prevDate = date
			continue
		}

		for (const token in currTokensUsd) {
			const currAmount = currTokens[token]
			const prevAmount = prevTokens[token]

			if (!currAmount || !prevAmount || currAmount === 0) continue

			const price = currTokensUsd[token] / currAmount
			const diff = currAmount - prevAmount
			const diffUsd = price * diff
			const currentFlow = tokenFlows.get(token) || 0
			tokenFlows.set(token, currentFlow + Math.abs(diffUsd))
		}

		prevDate = date
	}
}

// build unique tokens based on top 10 tokens in usd value on each day
// also includes tokens with significant flows (outflows/inflows > $100M)
function getUniqueTokens({
	chainTvls,
	extraTvlsEnabled
}: {
	chainTvls: ChainTvls
	extraTvlsEnabled: Record<string, boolean>
}) {
	const tokenSet: Set<string> = new Set()
	const tokenFlows: Map<string, number> = new Map()
	const latestTokenValues = new Map<string, number>()
	const SIGNIFICANT_FLOW_THRESHOLD = 100_000_000 // $100M

	for (const section in chainTvls) {
		const name = section.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (name.includes('-')) continue

		// Check if section is enabled
		const isEnabled = extraTvlsEnabled[name] ?? true
		if (!isEnabled) continue

		const sectionTokensInUsd = chainTvls[section].tokensInUsd ?? []
		const sectionTokens = chainTvls[section].tokens ?? []
		let othersCategoryExist = false

		// First pass: collect tokens based on top 10 USD values per day
		if (sectionTokensInUsd.length > 0) {
			for (const dayTokens of sectionTokensInUsd) {
				const [topTokens, tokenCount] = getTop10Tokens(dayTokens.tokens)

				if (tokenCount > 10) {
					othersCategoryExist = true
				}

				for (let i = 0; i < topTokens.length && i < 10; i++) {
					tokenSet.add(topTokens[i][0])
				}
			}

			const latestTokens = sectionTokensInUsd[sectionTokensInUsd.length - 1].tokens
			for (const token in latestTokens) {
				latestTokenValues.set(token, (latestTokenValues.get(token) ?? 0) + Math.abs(latestTokens[token]))
			}
		}

		// Second pass: calculate flows to identify tokens with significant flows
		if (sectionTokensInUsd.length > 0 && sectionTokens.length > 0) {
			accumulateTokenFlows({
				tokensInUsd: sectionTokensInUsd,
				tokens: sectionTokens,
				tokenFlows
			})
		}

		// Fallback: if tokensInUsd is empty, build unique tokens from raw tokens
		if (tokenSet.size === 0 && sectionTokens.length > 0) {
			for (const dayTokens of sectionTokens) {
				const [topTokens, tokenCount] = getTop10Tokens(dayTokens.tokens)

				if (tokenCount > 10) {
					othersCategoryExist = true
				}

				for (let i = 0; i < topTokens.length && i < 10; i++) {
					tokenSet.add(topTokens[i][0])
				}
			}

			const latestTokens = sectionTokens[sectionTokens.length - 1].tokens
			for (const token in latestTokens) {
				latestTokenValues.set(token, (latestTokenValues.get(token) ?? 0) + Math.abs(latestTokens[token]))
			}
		}

		// if 'others' exist, add it to the end of unique token list
		if (othersCategoryExist) {
			tokenSet.add('Others')
		}
	}

	// Add tokens with significant flows (> $100M) to the token set
	for (const [token, totalFlow] of tokenFlows) {
		if (totalFlow >= SIGNIFICANT_FLOW_THRESHOLD && !token.startsWith('UNKNOWN')) {
			tokenSet.add(token)
		}
	}

	if (tokenSet.size <= MAX_PROTOCOL_V1_BREAKDOWN_SERIES) return Array.from(tokenSet)

	tokenSet.delete(OTHERS_SERIES_NAME)
	const tokens = Array.from(tokenSet)
	tokens.sort((a, b) => (latestTokenValues.get(b) ?? 0) - (latestTokenValues.get(a) ?? 0))
	tokens.length = MAX_PROTOCOL_V1_BREAKDOWN_SERIES - 1
	tokens.push(OTHERS_SERIES_NAME)
	return tokens
}

// Helper to aggregate token balances for a given day into the provided directory.
// When `dateToTokensInUsd` is provided, `tokens` are interpreted as raw quantities
// and we can optionally filter out tokens whose raw size is huge but USD value is tiny.
function storeTokensBreakdown({
	date,
	tokens,
	tokensUniqueSet,
	directory,
	seenSeries,
	hideBigTokens = false,
	dateToTokensInUsd = null
}: {
	date: number
	tokens: Record<string, number>
	tokensUniqueSet: Set<string>
	directory: AccumulatedValueDirectory
	seenSeries?: Set<string>
	hideBigTokens?: boolean
	dateToTokensInUsd?: Map<number, Record<string, number>> | null
}) {
	const tokensToShow = new Map<string, number>()
	let remainingTokensSum = 0
	// filters tokens that have no name or their value is near zero
	for (const token in tokens) {
		const value = tokens[token]
		if (token.startsWith('UNKNOWN') || value < 1) continue

		// If we have both raw quantities and USD values (i.e. building the raw-quantity chart),
		// drop tokens where the raw balance is enormous but the USD value is very small or missing.
		// This avoids tokens with silly scales (e.g. 1T units but < $1M) from blowing up the raw chart.
		if (dateToTokensInUsd) {
			const usdForDate = dateToTokensInUsd.get(date)

			// If we have raw data but no USD snapshot for this date, skip this token
			// from the raw-quantity chart to avoid nonsense spikes.
			if (!usdForDate) continue

			const usdValue = usdForDate[token]

			// If this token has no USD value at this date, also skip it.
			if (usdValue === undefined) continue

			// If the raw balance is enormous but the USD value is tiny, drop it.
			if (value > 100_000_000 && usdValue < 1_000_000) continue
		}

		if (tokensUniqueSet.has(token)) {
			tokensToShow.set(token, value)
		} else {
			remainingTokensSum += value
		}
	}

	// add "Others" to tokens list
	if (!hideBigTokens && tokensUniqueSet.has('Others') && remainingTokensSum > 0) {
		tokensToShow.set('Others', (tokensToShow.get('Others') ?? 0) + remainingTokensSum)
	}

	let values = directory.get(date)
	if (!values) {
		values = new Map()
		directory.set(date, values)
	}

	for (const [token, value] of tokensToShow) {
		values.set(token, (values.get(token) ?? 0) + value)
		seenSeries?.add(token)
	}
}

function buildProtocolV1TokensBreakdown({
	chainTvls,
	extraTvlsEnabled,
	tokensUnique
}: {
	chainTvls: ChainTvls
	extraTvlsEnabled: Record<string, boolean>
	tokensUnique: string[]
}) {
	const tokensInUsd: AccumulatedValueDirectory = new Map()
	const rawTokens: AccumulatedValueDirectory = new Map()
	const tokensUniqueSet = new Set<string>(tokensUnique)
	const rawTokensUniqueSet = new Set<string>()

	for (const chain in chainTvls) {
		const name = chain.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (!name.includes('-')) {
			// sum key with staking, ethereum, arbitrum etc
			const isEnabled = extraTvlsEnabled[name] ?? true
			if (!isEnabled) continue

			// Build a per-chain map from date -> tokensInUsd so we can:
			// - aggregate the USD chart without any extra filtering
			// - when building the raw-quantity chart, filter out tokens with huge raw but tiny USD
			let dateToTokensInUsd: Map<number, Record<string, number>> | null = null

			const chainTokensInUsd = chainTvls[chain].tokensInUsd ?? []
			if (chainTokensInUsd.length > 0) {
				dateToTokensInUsd = new Map<number, Record<string, number>>()
				for (const { date, tokens } of chainTokensInUsd) {
					dateToTokensInUsd.set(date, tokens)
					// For the USD chart, values in `tokens` are already in USD, so we don't pass the map.
					storeTokensBreakdown({
						date,
						tokens,
						tokensUniqueSet,
						directory: tokensInUsd
					})
				}
			}

			// For the raw-quantity chart, we pass `dateToTokensInUsd` (when available) so that
			// `storeTokensBreakdown` can drop tokens where raw is huge but USD is very small.
			for (const { date, tokens } of chainTvls[chain].tokens ?? []) {
				storeTokensBreakdown({
					date,
					tokens,
					tokensUniqueSet,
					directory: rawTokens,
					seenSeries: rawTokensUniqueSet,
					hideBigTokens: true,
					dateToTokensInUsd
				})
			}
		}
	}

	const tokenBreakdownPieChart = []
	const usdDates = getSortedDates(tokensInUsd)
	if (usdDates.length > 0) {
		const lastEntry = tokensInUsd.get(usdDates[usdDates.length - 1])!
		for (const [name, value] of lastEntry) {
			tokenBreakdownPieChart.push({ name, value })
		}
	}

	const pieChartData = preparePieChartData({
		data: tokenBreakdownPieChart,
		limit: 15
	})
	const rawTokensUnique = tokensUnique.filter((token) => rawTokensUniqueSet.has(token))

	return {
		tokenBreakdownUSDDataset: buildTimestampDataset(tokensInUsd, tokensUnique, usdDates),
		tokenBreakdownPieChart: pieChartData,
		rawTokensUnique,
		tokenBreakdownDataset: buildTimestampDataset(rawTokens, rawTokensUnique)
	}
}

export const buildProtocolV1AddlChartsData = ({
	protocolData,
	extraTvlsEnabled,
	isBorrowed,
	tokenToExclude
}: {
	protocolData: {
		name: string
		chainTvls?: ChainTvls
		misrepresentedTokens?: boolean
	} | null
	extraTvlsEnabled: Record<string, boolean>
	isBorrowed?: boolean
	tokenToExclude?: string | null
}): ProtocolV1AddlChartsData => {
	if (!protocolData) return {}

	let chainTvls = protocolData.chainTvls ?? {}
	if (isBorrowed) {
		chainTvls = {}
		const sourceTvls = protocolData.chainTvls ?? {}
		for (const chain in sourceTvls) {
			if (chain.endsWith('-borrowed')) {
				const chainName = chain.slice(0, chain.lastIndexOf('-'))
				chainTvls[chainName] = sourceTvls[chain]
			}
		}
	}

	let tokensInUsdExists = false
	let tokensExists = false

	for (const chain in chainTvls) {
		const chainData = chainTvls[chain]
		if (!tokensInUsdExists && chainData.tokensInUsd && chainData.tokensInUsd.length > 0) {
			tokensInUsdExists = true
		}

		if (!tokensExists && chainData.tokens && chainData.tokens.length > 0) {
			tokensExists = true
		}
	}

	if (!protocolData.misrepresentedTokens && (tokensInUsdExists || tokensExists)) {
		let tokensUnique = getUniqueTokens({ chainTvls, extraTvlsEnabled })

		// Filter out the excluded token if specified
		if (tokenToExclude) {
			tokensUnique = tokensUnique.filter((token) => token !== tokenToExclude)
		}

		const { rawTokensUnique, tokenBreakdownUSDDataset, tokenBreakdownPieChart, tokenBreakdownDataset } =
			buildProtocolV1TokensBreakdown({
				chainTvls,
				extraTvlsEnabled,
				tokensUnique
			})

		const { usdInflowsDataset, tokenInflowsDataset } = buildProtocolV1Inflows({
			chainTvls,
			extraTvlsEnabled,
			tokensUnique,
			datesToDelete: protocolData.name === 'Binance CEX' ? [1681430400, 1681516800] : [],
			tokenToExclude
		})

		return {
			tokensUnique,
			rawTokensUnique,
			tokenBreakdownUSDDataset,
			tokenBreakdownPieChart,
			tokenBreakdownDataset,
			usdInflowsDataset,
			tokenInflowsDataset
		}
	}

	return {}
}

export const useFetchProtocolV1AddlChartsData = (
	protocolName: string,
	isBorrowed = false,
	tokenToExclude?: string | null,
	enabled = true
) => {
	const { data: addlProtocolData, isLoading } = useQuery<IProtocolOverviewMetricsV1>({
		queryKey: ['protocol-overview-v1', protocolName, 'metrics'],
		queryFn: () => fetchProtocolBySlug<IProtocolOverviewMetricsV1>(protocolName),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled
	})
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl_fees')

	// Normalize to null for consistent caching
	const normalizedTokenToExclude = tokenToExclude || null

	const data = useQuery({
		queryKey: [
			'protocol-overview',
			'addl-chart-data',
			protocolName,
			isBorrowed ? 'borrowed' : JSON.stringify(extraTvlsEnabled),
			normalizedTokenToExclude
		],
		queryFn: () =>
			buildProtocolV1AddlChartsData({
				protocolData: addlProtocolData ?? null,
				extraTvlsEnabled: isBorrowed ? {} : extraTvlsEnabled,
				isBorrowed,
				tokenToExclude: normalizedTokenToExclude
			}),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: enabled && Boolean(addlProtocolData)
	})

	const historicalChainTvls = useMemo(() => {
		if (!enabled) return null
		if (isBorrowed) {
			const chainTvls = {}
			const sourceTvls = addlProtocolData?.chainTvls ?? {}
			for (const chain in sourceTvls) {
				if (chain.endsWith('-borrowed')) {
					const chainName = chain.slice(0, chain.lastIndexOf('-'))
					chainTvls[chainName] = sourceTvls[chain]
				}
			}
			return chainTvls
		}
		return addlProtocolData?.chainTvls ?? null
	}, [addlProtocolData, isBorrowed, enabled])

	return {
		...data,
		historicalChainTvls,
		isLoading: data.isLoading || isLoading
	}
}
