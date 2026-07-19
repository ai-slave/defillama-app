import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type { MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { fetchProtocolBySlug } from './api'
import type { IProtocolChainTvlEntry, IProtocolOverviewMetricsV1 } from './api.types'

type ChainTvlEntry = IProtocolChainTvlEntry
type ChainTvls = Record<string, ChainTvlEntry>
type AccumulatedValueRow = Record<string, number>

export const MAX_PROTOCOL_V1_BREAKDOWN_SERIES = 30
const OTHERS_SERIES_NAME = 'Others'

function getOwnNumber(record: Record<string, number>, key: string) {
	return Object.hasOwn(record, key) ? record[key] : undefined
}

function setChartRowValue(row: Record<string, number>, name: string, value: number) {
	if (name === '__proto__') {
		Object.defineProperty(row, name, { value, enumerable: true, configurable: true, writable: true })
	} else {
		row[name] = value
	}
}

export type ProtocolV1AddlChartsData = {
	tokensUnique?: string[]
	rawTokensUnique?: string[]
	tokenBreakdownUSDDataset?: TimestampDataset
	tokenBreakdownPieChart?: Array<{ name: string; value: number }>
	tokenBreakdownDataset?: TimestampDataset
	usdInflowsDataset?: TimestampDataset | null
	tokenInflowsDataset?: TimestampDataset | null
}

function getSortedNumericKeys(directory: Record<string, unknown>): number[] {
	const keys = Object.keys(directory)
	const dates = new Array<number>(keys.length)
	for (let i = 0; i < keys.length; i++) dates[i] = +keys[i]
	dates.sort((a, b) => a - b)
	return dates
}

function buildTimestampDataset(
	directory: Record<string, AccumulatedValueRow>,
	seriesNames: string[],
	sortedDates = getSortedNumericKeys(directory)
): TimestampDataset {
	const source = new Array<TimestampDataset['source'][number]>(sortedDates.length)
	for (let i = 0; i < sortedDates.length; i++) {
		const date = sortedDates[i]
		const values = directory[date]
		const nextRow = createChartRow<number>(date * 1e3)
		for (const name in values) setChartRowValue(nextRow, name, values[name])
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
	type: MultiSeriesChart2SeriesConfig['type']
	colors?: Record<string, string>
	stack?: string
	hideAreaStyle?: boolean
}): MultiSeriesChart2SeriesConfig[] {
	const charts = new Array<MultiSeriesChart2SeriesConfig>(seriesNames.length)
	for (let i = 0; i < seriesNames.length; i++) {
		const name = seriesNames[i]
		charts[i] = {
			type,
			name,
			encode: { x: 'timestamp', y: name },
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
	const tvlDictionary = createChartRecord<AccumulatedValueRow>()

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
			if (!Object.hasOwn(extraTvlsEnabled, name)) {
				toSumSection = true
			}
		}

		if (toSumSection) {
			const tvl = historicalChainTvls[section].tvl
			if (tvl) {
				for (const { date, totalLiquidityUSD } of tvl) {
					if (!tvlDictionary[date]) {
						tvlDictionary[date] = createChartRecord<number>()
					}

					tvlDictionary[date][sectionName] = (tvlDictionary[date][sectionName] || 0) + totalLiquidityUSD
				}
			}
		}
	}

	const dates = getSortedNumericKeys(tvlDictionary)
	const lastEntry = dates.length > 0 ? tvlDictionary[dates[dates.length - 1]] : undefined
	const chainsUnique: string[] = []
	if (lastEntry) {
		for (const key in lastEntry) {
			chainsUnique.push(key)
		}
	}

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
	const usdInflows = createChartRecord<number>()
	const tokenInflows = createChartRecord<AccumulatedValueRow>()
	const tokensUniqueSet = new Set(tokensUnique)

	let zeroUsdInfows = 0
	let zeroTokenInfows = 0

	for (const section in chainTvls) {
		const name = section.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (name.includes('-')) continue

		const isEnabled = Object.hasOwn(extraTvlsEnabled, name) ? extraTvlsEnabled[name] : true
		if (!isEnabled) continue

		// Index per-date maps
		const tokensInUsdByDate: Record<number, Record<string, number>> = {}
		const tokensByDate: Record<number, Record<string, number>> = {}
		const dateSet = new Set<number>()

		for (const { date, tokens } of chainTvls[section]?.tokensInUsd ?? []) {
			tokensInUsdByDate[date] = tokens
			dateSet.add(date)
		}
		for (const { date, tokens } of chainTvls[section]?.tokens ?? []) {
			tokensByDate[date] = tokens
			dateSet.add(date)
		}

		const dates = Array.from(dateSet).sort((a, b) => a - b)

		for (let i = 1; i < dates.length; i++) {
			const currentDate = dates[i]
			const prevDate = dates[i - 1]

			const currentTokens = tokensByDate[currentDate] || {}
			const oldTokens = tokensByDate[prevDate] || {}
			const currentUsdTokens = tokensInUsdByDate[currentDate] || {}
			const oldUsdTokens = tokensInUsdByDate[prevDate] || {}

			// Build price map using larger totalUSD preference
			const priceMap = createChartRecord<{ value: number; totalUSD: number }>()
			for (const token in currentUsdTokens) {
				if (!Object.hasOwn(currentUsdTokens, token)) continue
				const amount = getOwnNumber(currentTokens, token)
				const usd = currentUsdTokens[token]
				if (amount && amount > 0) {
					priceMap[token] = { value: usd / amount, totalUSD: usd }
				}
			}
			for (const token in oldUsdTokens) {
				if (!Object.hasOwn(oldUsdTokens, token)) continue
				const amount = getOwnNumber(oldTokens, token)
				const usd = oldUsdTokens[token]
				if (amount && amount > 0) {
					if (!priceMap[token] || priceMap[token].totalUSD < usd) {
						priceMap[token] = { value: usd / amount, totalUSD: usd }
					}
				}
			}

			let dayDifference = 0
			let selectedTokenDifference = 0
			const tokenDayDifference = createChartRecord<number>()

			const addTokenDifference = (token: string) => {
				// Skip excluded token
				if (tokenToExclude && token === tokenToExclude) return

				const currentAmount = getOwnNumber(currentTokens, token) ?? 0
				const prevAmount = getOwnNumber(oldTokens, token) ?? 0
				const diff = currentAmount - prevAmount
				if (diff === 0) return

				let priceInfo = priceMap[token]
				if (!priceInfo) {
					// Fallback price from whichever side has info
					const currentUsdValue = getOwnNumber(currentUsdTokens, token)
					const previousUsdValue = getOwnNumber(oldUsdTokens, token)
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
					tokenDayDifference[token] = (tokenDayDifference[token] || 0) + diffUsd
					selectedTokenDifference += diffUsd
				}
			}

			for (const token in currentTokens) {
				if (Object.hasOwn(currentTokens, token)) addTokenDifference(token)
			}
			for (const token in oldTokens) {
				if (Object.hasOwn(oldTokens, token) && !Object.hasOwn(currentTokens, token)) addTokenDifference(token)
			}

			if (tokensUniqueSet.has(OTHERS_SERIES_NAME)) {
				const othersDifference = dayDifference - selectedTokenDifference
				if (othersDifference !== 0) {
					tokenDayDifference[OTHERS_SERIES_NAME] = (tokenDayDifference[OTHERS_SERIES_NAME] || 0) + othersDifference
				}
			}

			if (dayDifference === 0) {
				zeroUsdInfows++
			}

			let hasTokenDifference = false
			for (const _ in tokenDayDifference) {
				hasTokenDifference = true
				break
			}
			if (!hasTokenDifference) {
				zeroTokenInfows++
			}

			usdInflows[currentDate] = (usdInflows[currentDate] || 0) + dayDifference

			if (!tokenInflows[currentDate]) tokenInflows[currentDate] = createChartRecord<number>()
			// Merge existing values accumulated from other chains before writing
			for (const token in tokenInflows[currentDate]) {
				tokenDayDifference[token] = (tokenDayDifference[token] || 0) + tokenInflows[currentDate][token]
			}
			for (const token in tokenDayDifference) {
				tokenInflows[currentDate][token] = tokenDayDifference[token]
			}
		}
	}

	for (const date of datesToDelete) {
		delete usdInflows[String(date)]
		delete tokenInflows[String(date)]
	}

	const usdFlowRows = createChartRecord<AccumulatedValueRow>()
	for (const date in usdInflows) {
		const row = createChartRecord<number>()
		row['USD Inflows'] = usdInflows[date]
		usdFlowRows[date] = row
	}
	const usdFlowDates = getSortedNumericKeys(usdFlowRows)
	const tokenFlowDates = getSortedNumericKeys(tokenInflows)

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
		if (!Object.hasOwn(tokens, token)) continue
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

	const tokensInUsdMap: Record<number, Record<string, number>> = {}
	const tokensMap: Record<number, Record<string, number>> = {}

	for (const { date, tokens: tokenData } of tokensInUsd) {
		tokensInUsdMap[date] = tokenData
	}

	for (const { date, tokens: tokenData } of tokens) {
		tokensMap[date] = tokenData
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

		const currTokensUsd = tokensInUsdMap[date]
		const currTokens = tokensMap[date]
		const prevTokens = tokensMap[prevDate]

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
	const latestTokenValues = createChartRecord<number>()
	const SIGNIFICANT_FLOW_THRESHOLD = 100_000_000 // $100M

	for (const section in chainTvls) {
		const name = section.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (name.includes('-')) continue

		// Check if section is enabled
		const isEnabled = Object.hasOwn(extraTvlsEnabled, name) ? extraTvlsEnabled[name] : true
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
				if (Object.hasOwn(latestTokens, token)) {
					latestTokenValues[token] = (latestTokenValues[token] ?? 0) + Math.abs(latestTokens[token])
				}
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
				if (Object.hasOwn(latestTokens, token)) {
					latestTokenValues[token] = (latestTokenValues[token] ?? 0) + Math.abs(latestTokens[token])
				}
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
	tokens.sort((a, b) => (latestTokenValues[b] ?? 0) - (latestTokenValues[a] ?? 0))
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
	directory: Record<string | number, AccumulatedValueRow>
	seenSeries?: Set<string>
	hideBigTokens?: boolean
	dateToTokensInUsd?: Map<number, Record<string, number>> | null
}) {
	const tokensOfTheDay = createChartRecord<number>()
	// filters tokens that have no name or their value is near zero
	for (const token in tokens) {
		if (token.startsWith('UNKNOWN') || tokens[token] < 1) continue

		// If we have both raw quantities and USD values (i.e. building the raw-quantity chart),
		// drop tokens where the raw balance is enormous but the USD value is very small or missing.
		// This avoids tokens with silly scales (e.g. 1T units but < $1M) from blowing up the raw chart.
		if (dateToTokensInUsd) {
			const usdForDate = dateToTokensInUsd.get(date)

			// If we have raw data but no USD snapshot for this date, skip this token
			// from the raw-quantity chart to avoid nonsense spikes.
			if (!usdForDate) continue

			const usdValue = getOwnNumber(usdForDate, token)

			// If this token has no USD value at this date, also skip it.
			if (usdValue === undefined) continue

			// If the raw balance is enormous but the USD value is tiny, drop it.
			if (tokens[token] > 100_000_000 && usdValue < 1_000_000) continue
		}

		tokensOfTheDay[token] = tokens[token]
	}

	const tokensToShow = createChartRecord<number>()
	let remainingTokensSum = 0

	// split tokens of the day into tokens present in top 10 tokens list and add tvl of remaining tokens into category named 'Others'
	for (const token in tokensOfTheDay) {
		if (tokensUniqueSet.has(token)) {
			tokensToShow[token] = tokensOfTheDay[token]
		} else {
			remainingTokensSum += tokensOfTheDay[token]
		}
	}

	// add "Others" to tokens list
	if (!hideBigTokens && tokensUniqueSet.has('Others') && remainingTokensSum > 0) {
		tokensToShow['Others'] = (getOwnNumber(tokensToShow, 'Others') ?? 0) + remainingTokensSum
	}

	const dir: AccumulatedValueRow = directory[date] ?? createChartRecord<number>()

	for (const token in tokensToShow) {
		dir[token] = (dir[token] ?? 0) + tokensToShow[token]
		seenSeries?.add(token)
	}

	directory[date] = dir
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
	const tokensInUsd = createChartRecord<AccumulatedValueRow>()
	const rawTokens = createChartRecord<AccumulatedValueRow>()
	const tokensUniqueSet = new Set<string>(tokensUnique)
	const rawTokensUniqueSet = new Set<string>()

	for (const chain in chainTvls) {
		const name = chain.toLowerCase()

		// skip sum of keys like ethereum-staking, arbitrum-vesting
		if (!name.includes('-')) {
			// sum key with staking, ethereum, arbitrum etc
			const isEnabled = Object.hasOwn(extraTvlsEnabled, name) ? extraTvlsEnabled[name] : true
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
	const usdDates = getSortedNumericKeys(tokensInUsd)
	if (usdDates.length > 0) {
		const lastEntry = tokensInUsd[usdDates[usdDates.length - 1]]
		for (const name in lastEntry) {
			tokenBreakdownPieChart.push({ name, value: lastEntry[name] })
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
		chainTvls = createChartRecord<ChainTvlEntry>()
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
			const chainTvls = createChartRecord<ChainTvlEntry>()
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
