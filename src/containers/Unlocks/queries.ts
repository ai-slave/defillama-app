import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchCoinPrices as fetchCoinPricesBatched } from '~/api/pricing'
import { DATASETS_SERVER_URL } from '~/constants'
import { buildUnlocksMultiSeriesChartForDateRange } from '~/containers/Unlocks/buildUnlocksMultiSeriesChart'
import type { PrecomputedData, UnlocksData } from '~/containers/Unlocks/calendarTypes'
import { batchFetchHistoricalPrices, capitalizeFirstLetter, getNDistinctColors } from '~/utils'
import { fetchJson, getSlowJsonTimeoutMs } from '~/utils/async'
import type { IEmissionsHistoricalPrices, ITokenListEntry } from '~/utils/metadata/types'
import { buildUnlocksHistoricalPriceRequests } from '~/utils/unlocks/historicalPriceRequests'
import { fetchProtocolEmission, fetchAllProtocolEmissions } from './api'
import type {
	EmissionsDataset,
	EmissionsChartRow,
	EmissionsChartConfig,
	EmissionEvent,
	ProtocolEmission,
	ProtocolEmissionChartData,
	ProtocolEmissionDetail,
	ProtocolEmissionNext24h,
	TokenAllocationSplit,
	TokenIncentiveChartPoint
} from './api.types'
import { isWeeklyRateCalendarEvent, type CalendarUnlockEvent } from './calendarTypes'
import { buildEmissionProjectionModel } from './emissionsChartData'
import { getEmissionAmountBreakdownOverInterval, getEmissionEventAmount, isUnknownEmissionEvent } from './eventAmount'
import type { EmptyProtocolEmissionResult, ProtocolEmissionResult, ProtocolEmissionResultMeta } from './types'

type UnlockTokenlistEntry = Pick<ITokenListEntry, 'current_price' | 'symbol'>
type UnlockTokenlist = Record<string, UnlockTokenlistEntry | undefined>
type UnlockCurrentPrice = {
	price?: number | null
	symbol?: string | null
}
const TOKEN_LIST_API_URL = `${DATASETS_SERVER_URL}/tokenlist/rankings.json`
let unlockTokenlistPromise: Promise<UnlockTokenlist> | null = null

function buildEmissionsDataset(chartData: Array<EmissionsChartRow>, stacks: Array<string>): EmissionsDataset {
	const source: EmissionsDataset['source'] = []
	for (const input of chartData) {
		const row: EmissionsDataset['source'][number] = [input.timestamp]
		for (const stack of stacks) row.push(input[stack] ?? null)
		source.push(row)
	}
	return {
		source,
		dimensions: ['timestamp', ...stacks]
	}
}

function buildEmissionsCharts(stacks: Array<string>, colors: Record<string, string>): EmissionsChartConfig {
	const charts: EmissionsChartConfig = []
	for (let index = 0; index < stacks.length; index++) {
		const name = stacks[index]!
		const color = colors[name]
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 },
			...(color !== undefined ? { color } : {}),
			stack: 'A'
		})
	}
	return charts
}

function formatEmissionLabel(label: string): string {
	if (!label) return ''
	return label
		.split(' ')
		.map((l) => capitalizeFirstLetter(l))
		.join(' ')
}

const EMPTY_TOKEN_ALLOCATION_SPLIT: TokenAllocationSplit = {
	current: {},
	final: {},
	progress: {},
	bySection: { current: {}, final: {}, progress: {} }
}

function getTokenAllocation(input: TokenAllocationSplit | undefined): TokenAllocationSplit {
	return input ?? EMPTY_TOKEN_ALLOCATION_SPLIT
}

function getAllocationSupplyAtOrBefore(
	points: ProtocolEmissionChartData['data'][number]['data'],
	timestampSec: number
): number {
	let low = 0
	let high = points.length - 1
	let supply = 0

	while (low <= high) {
		const middle = Math.floor((low + high) / 2)
		const point = points[middle]!
		if (point.timestamp <= timestampSec) {
			supply = point.unlocked
			low = middle + 1
		} else {
			high = middle - 1
		}
	}

	return supply
}

function getTotalSupplyAtOrBefore(data: ProtocolEmissionChartData, timestampSec: number): number {
	let supply = 0
	for (const allocation of data.data) {
		supply += getAllocationSupplyAtOrBefore(allocation.data, timestampSec)
	}
	return supply
}

function getFinalSupply(data: ProtocolEmissionChartData): number {
	let supply = 0
	for (const allocation of data.data) {
		const finalPoint = allocation.data[allocation.data.length - 1]
		if (finalPoint) supply += finalPoint.unlocked
	}
	return supply
}

function buildProtocolEmissionResultMeta(
	res: ProtocolEmissionDetail,
	nowSec: number,
	tokenPrice: number | undefined
): ProtocolEmissionResultMeta | null {
	const maxSupply = res.supplyMetrics?.maxSupply ?? res.metadata.total ?? getFinalSupply(res.documentedData)
	if (!Number.isFinite(maxSupply) || maxSupply <= 0) return null

	const circSupply = getTotalSupplyAtOrBefore(res.documentedData, nowSec)
	return {
		gecko_id: res.gecko_id,
		circSupply,
		maxSupply,
		totalLocked: Math.max(maxSupply - circSupply, 0),
		...(tokenPrice !== undefined ? { mcap: circSupply * tokenPrice } : {})
	}
}

function isPositiveNumber(value: number | null | undefined): value is number {
	return value != null && value > 0
}

function normalizeTokenlistSymbol(value: string): string | null {
	return value ? value.toUpperCase() : null
}

function projectUnlockTokenlist(rankings: Array<IResponseCGTokenRankingsDatasetItem>): UnlockTokenlist {
	const tokenlist: UnlockTokenlist = {}
	for (const ranking of rankings) {
		tokenlist[ranking.id] = {
			current_price: ranking.current_price ?? null,
			symbol: ranking.symbol
		}
	}
	return tokenlist
}

export async function fetchUnlockTokenlistPrices(): Promise<UnlockTokenlist> {
	if (unlockTokenlistPromise) return unlockTokenlistPromise

	unlockTokenlistPromise = fetchJson<Array<IResponseCGTokenRankingsDatasetItem>>(TOKEN_LIST_API_URL, {
		timeout: getSlowJsonTimeoutMs()
	})
		.then(projectUnlockTokenlist)
		.catch((error) => {
			unlockTokenlistPromise = null
			console.error('Failed to fetch unlock tokenlist prices:', error)
			return {}
		})

	return unlockTokenlistPromise
}

function getTokenlistCurrentPrice(
	geckoId: string | null | undefined,
	tokenlist?: UnlockTokenlist
): UnlockCurrentPrice | null {
	if (!geckoId || !tokenlist) return null
	const token = tokenlist[geckoId]
	if (!isPositiveNumber(token?.current_price)) return null
	return {
		price: token.current_price,
		symbol: normalizeTokenlistSymbol(token.symbol)
	}
}

async function fetchCurrentUnlockPrices({
	protocols,
	tokenlist
}: {
	protocols: Array<Pick<ProtocolEmission, 'gecko_id'>>
	tokenlist?: UnlockTokenlist
}): Promise<Record<string, UnlockCurrentPrice | undefined>> {
	const prices: Record<string, UnlockCurrentPrice | undefined> = {}
	const geckoIds = new Set<string>()

	for (const protocol of protocols) {
		const geckoId = protocol.gecko_id
		if (geckoId) geckoIds.add(geckoId)
	}

	if (geckoIds.size === 0) return prices

	const tokenlistPrices = tokenlist ?? (await fetchUnlockTokenlistPrices())
	const missingCoinIds = new Set<string>()

	for (const geckoId of geckoIds) {
		const coinKey = `coingecko:${geckoId}`
		const tokenlistPrice = getTokenlistCurrentPrice(geckoId, tokenlistPrices)
		if (tokenlistPrice) {
			prices[coinKey] = tokenlistPrice
		} else {
			missingCoinIds.add(coinKey)
		}
	}

	if (missingCoinIds.size > 0 && !tokenlist) {
		Object.assign(prices, await fetchCoinPricesBatched([...missingCoinIds]))
	}

	return prices
}

function buildEmissionsSeriesAndCategories(input: ProtocolEmissionChartData | null | undefined): {
	series: Map<number, Record<string, number | null>>
	categories: Array<string>
	tbdSections: Array<string>
	forecastSections: Array<string>
} {
	const series = new Map<number, Record<string, number | null>>()
	const categories: Array<string> = []
	const seen = new Set<string>()
	const tbdSections: Array<string> = []
	const forecastSections: Array<string> = []
	if (!input) return { series, categories, tbdSections, forecastSections }

	for (const emission of input.data) {
		const label = formatEmissionLabel(emission.label)
		if (!label) continue

		if (!seen.has(label)) {
			seen.add(label)
			categories.push(label)
		}
		// Projection is a series-level property duplicated on every live API point.
		// Read the first point once instead of checking it in the row-construction loop.
		const firstValue = emission.data[0]
		if (firstValue?.isTBD) tbdSections.push(label)
		else if (firstValue?.isForecast) forecastSections.push(label)

		for (const value of emission.data) {
			const ts = value.timestamp
			let entry = series.get(ts)
			if (!entry) {
				const createdEntry: Record<string, number | null> = {}
				series.set(ts, createdEntry)
				entry = createdEntry
			}
			entry[label] = value.unlocked
		}
	}

	return { series, categories, tbdSections, forecastSections }
}

function seriesToChartRows(series: Map<number, Record<string, number | null>>): Array<EmissionsChartRow> {
	const rows: Array<EmissionsChartRow> = []
	for (const [timestamp, values] of series) {
		const row: EmissionsChartRow = { timestamp: timestamp * 1e3 }
		for (const label in values) {
			const value = values[label]
			if (value !== undefined) row[label] = value
		}
		rows.push(row)
	}
	rows.sort((a, b) => a.timestamp - b.timestamp)
	return rows
}

function buildPieFromChart(chart: Array<EmissionsChartRow>): Array<{ name: string; value: number }> {
	if (chart.length === 0) return []
	const last = chart[chart.length - 1]!
	const pie: Array<{ name: string; value: number }> = []
	for (const key in last) {
		if (key !== 'timestamp') {
			const value = last[key]
			if (value != null) {
				pie.push({ name: key, value })
			}
		}
	}
	return pie
}

function buildColorsForPie(
	pie: Array<{ name: string }>,
	colorFrom: Record<string, string> = {}
): Record<string, string> {
	const colors: Record<string, string> = {}
	const names = new Set(pie.map((entry) => entry.name))
	const baseNameCache = new Map<string, string>()
	const baseNameOf = (name: string): string => {
		const cached = baseNameCache.get(name)
		if (cached) return cached

		const visited: Array<string> = []
		const seen = new Set<string>()
		let current = name

		for (;;) {
			const next = colorFrom[current]
			if (!next || !names.has(next)) break
			if (seen.has(next)) {
				const cycle = [...visited, current, next].filter((item, index, values) => values.indexOf(item) === index)
				current = cycle.toSorted()[0]!
				break
			}
			visited.push(current)
			seen.add(current)
			current = next
		}

		for (const visitedName of visited) baseNameCache.set(visitedName, current)
		baseNameCache.set(name, current)
		return current
	}

	const primary = pie.filter((entry) => baseNameOf(entry.name) === entry.name)
	const palette = getNDistinctColors(primary.length)
	for (let index = 0; index < primary.length; index++) {
		colors[primary[index]!.name] = palette[index]!
	}
	for (const entry of pie) {
		if (colors[entry.name]) continue
		colors[entry.name] = colors[baseNameOf(entry.name)]!
	}
	return colors
}

export async function getProtocolUnlockUsdChart(protocolName: string): Promise<Array<TokenIncentiveChartPoint> | null> {
	const res = await fetchProtocolEmission(protocolName)
	return res?.unlockUsdChart ?? null
}

export async function getProtocolEmissionsCharts(protocolName: string): Promise<{
	chartData: {
		documented: Array<EmissionsChartRow>
		realtime: Array<EmissionsChartRow>
	}
	unlockUsdChart: Array<TokenIncentiveChartPoint> | null
}> {
	const empty = {
		chartData: { documented: [], realtime: [] },
		unlockUsdChart: null
	}
	if (!protocolName) return empty

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return empty

	const documentedData = res.documentedData
	const realTimeData = res.realTimeData

	const documented = buildEmissionsSeriesAndCategories(documentedData).series
	const realtime = buildEmissionsSeriesAndCategories(realTimeData).series

	const documentedChart = seriesToChartRows(documented)
	const realtimeChart = seriesToChartRows(realtime)

	return {
		chartData: { documented: documentedChart, realtime: realtimeChart },
		unlockUsdChart: res.unlockUsdChart
	}
}

interface ProtocolEmissionsScheduleData {
	datasets: { documented: EmissionsDataset; realtime: EmissionsDataset }
	chartsConfigs: {
		documented: EmissionsChartConfig
		realtime: EmissionsChartConfig
	}
	categories: { documented: Array<string>; realtime: Array<string> }
	hallmarks: { documented: Array<[number, string]>; realtime: Array<[number, string]> }
}

export async function getProtocolEmissionsScheduleData(protocolName: string): Promise<ProtocolEmissionsScheduleData> {
	const empty: ProtocolEmissionsScheduleData = {
		datasets: {
			documented: { source: [], dimensions: ['timestamp'] },
			realtime: { source: [], dimensions: ['timestamp'] }
		},
		chartsConfigs: { documented: [], realtime: [] },
		categories: { documented: [], realtime: [] },
		hallmarks: { documented: [], realtime: [] }
	}

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return empty

	const documentedBuilt = buildEmissionsSeriesAndCategories(res.documentedData)
	const realtimeBuilt = buildEmissionsSeriesAndCategories(res.realTimeData)
	const categories = {
		documented: documentedBuilt.categories,
		realtime: realtimeBuilt.categories
	}

	const documentedChart = seriesToChartRows(documentedBuilt.series)
	const realtimeChart = seriesToChartRows(realtimeBuilt.series)

	// Assign colors by category order to keep schedule charts fully colored.
	const documentedPalette = getNDistinctColors(categories.documented.length)
	const documentedColors: Record<string, string> = {}
	for (let index = 0; index < categories.documented.length; index++) {
		const category = categories.documented[index]!
		const color = documentedPalette[index]!
		documentedColors[category] = color
	}

	const realtimePalette = getNDistinctColors(categories.realtime.length)
	const realtimeColors: Record<string, string> = {}
	for (let index = 0; index < categories.realtime.length; index++) {
		const category = categories.realtime[index]!
		const color = realtimePalette[index]!
		realtimeColors[category] = color
	}

	const datasets = {
		documented: buildEmissionsDataset(documentedChart, categories.documented),
		realtime: buildEmissionsDataset(realtimeChart, categories.realtime)
	}
	const chartsConfigs = {
		documented: buildEmissionsCharts(categories.documented, documentedColors),
		realtime: buildEmissionsCharts(categories.realtime, realtimeColors)
	}

	const nowSec = Date.now() / 1000
	const documentedHasData = res.documentedData.data.length > 0
	const realtimeHasData = res.realTimeData !== undefined && res.realTimeData.data.length > 0

	return {
		datasets,
		chartsConfigs,
		categories,
		hallmarks: {
			documented: documentedHasData ? [[nowSec, 'Today']] : [],
			realtime: realtimeHasData ? [[nowSec, 'Today']] : []
		}
	}
}

type ProtocolEmissionSupplyMeta = Pick<ProtocolEmission, 'totalLocked' | 'maxSupply'>

export async function getProtocolEmissionsPieData(
	protocolName: string,
	includeSupplyMeta: boolean
): Promise<{
	pieChartData: {
		documented: Array<{ name: string; value: number }>
		realtime: Array<{ name: string; value: number }>
	}
	stackColors: {
		documented: Record<string, string>
		realtime: Record<string, string>
	}
	meta: ProtocolEmissionSupplyMeta | null
}> {
	const empty = {
		pieChartData: { documented: [], realtime: [] },
		stackColors: { documented: {}, realtime: {} },
		meta: null
	}

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return empty

	const documentedBuilt = buildEmissionsSeriesAndCategories(res.documentedData)
	const realtimeBuilt = buildEmissionsSeriesAndCategories(res.realTimeData)

	const documentedChart = seriesToChartRows(documentedBuilt.series)
	const realtimeChart = seriesToChartRows(realtimeBuilt.series)

	const pieChartData = {
		documented: buildPieFromChart(documentedChart),
		realtime: buildPieFromChart(realtimeChart)
	}
	const colorFrom = extractColorFromMap(res)
	const stackColors = {
		documented: buildColorsForPie(pieChartData.documented, colorFrom),
		realtime: buildColorsForPie(pieChartData.realtime, colorFrom)
	}

	const token = res.metadata.token
	const meta = includeSupplyMeta
		? ((await fetchAllProtocolEmissions()).find((protocol) => protocol.token === token) ?? null)
		: null

	return { pieChartData, stackColors, meta }
}

export function buildUnlockTypesByTimestamp(allEventsForProtocol: ReadonlyArray<EmissionEvent>): Map<number, string> {
	const nowSec = Math.floor(Date.now() / 1000)
	const unlockTypes = new Map<number, string>()
	// The emissions API contract is timestamp-ascending. Filtering preserves that
	// order, so classify adjacent future events without copying or re-sorting.
	let event: EmissionEvent | undefined
	for (const nextEvent of allEventsForProtocol) {
		if (nextEvent.noOfTokens.length === 0) continue
		if (!event) {
			event = nextEvent
			continue
		}
		if (event.timestamp > nowSec && !unlockTypes.has(event.timestamp)) {
			const diffToNextEventDays = (nextEvent.timestamp - event.timestamp) / (60 * 60 * 24)
			let unlockType = ''
			if (diffToNextEventDays > 6.5 && diffToNextEventDays < 7.5) unlockType = 'Weekly'
			else if (diffToNextEventDays > 28 && diffToNextEventDays < 32) unlockType = 'Monthly'
			else if (diffToNextEventDays > 88 && diffToNextEventDays < 92) unlockType = 'Quarterly'
			unlockTypes.set(event.timestamp, unlockType)
		}
		event = nextEvent
	}
	return unlockTypes
}

export async function getUnlocksCalendarStaticPropsData(): Promise<{
	unlocksData: UnlocksData
	precomputedData: PrecomputedData
}> {
	// Import dayjs lazily to keep this server-oriented builder isolated.
	const dayjs = (await import('dayjs')).default
	const utcPlugin = (await import('dayjs/plugin/utc')).default
	dayjs.extend(utcPlugin)

	const data = await getAllProtocolEmissionsWithHistory()
	const unlocksData: UnlocksData = {}

	const precomputedData: Required<PrecomputedData> = {
		monthlyMaxValues: {},
		listEvents: {},
		weekCharts: {},
		monthCharts: {}
	}

	for (const protocol of data) {
		if (protocol.tPrice == null || protocol.tPrice <= 0) continue

		const unlockTypesByTimestamp = buildUnlockTypesByTimestamp(protocol.events)

		type ProtocolCalendarEntry = {
			value: number
			details: Array<string>
			unlockTypes: Array<string>
			category?: string
		}
		const protocolUnlocksByDate: Record<
			string,
			{
				one_time?: ProtocolCalendarEntry
				weekly_rate?: ProtocolCalendarEntry
			}
		> = {}

		for (const event of protocol.events) {
			const totalTokens = getEmissionEventAmount(event)
			if (totalTokens === null || totalTokens <= 0) continue

			const valueUSD = totalTokens * protocol.tPrice
			const dateStr = new Date(event.timestamp * 1000).toISOString().slice(0, 10)
			const unlockType = unlockTypesByTimestamp.get(event.timestamp) ?? ''
			const valueUnit = event.unlockType === 'linear' ? 'weekly_rate' : 'one_time'
			const dailyEntries = protocolUnlocksByDate[dateStr] ?? (protocolUnlocksByDate[dateStr] = {})
			const entry =
				dailyEntries[valueUnit] ??
				(dailyEntries[valueUnit] = {
					value: 0,
					details: [],
					unlockTypes: [],
					category: event.category
				})

			entry.value += valueUSD
			entry.details.push(event.description)
			entry.unlockTypes.push(unlockType)
			entry.category = event.category
		}

		for (const dateStr in protocolUnlocksByDate) {
			const dailyEntries = protocolUnlocksByDate[dateStr]!
			const unlockDay = unlocksData[dateStr] ?? { totalValue: 0, events: [] }
			unlocksData[dateStr] = unlockDay

			for (const valueUnit of ['one_time', 'weekly_rate'] as const) {
				const dailyData = dailyEntries[valueUnit]
				if (dailyData === undefined) continue
				if (valueUnit === 'one_time') unlockDay.totalValue += dailyData.value
				const calendarEvent = {
					protocol: protocol.name,
					geckoId: protocol.gecko_id ?? null,
					value: dailyData.value,
					details: dailyData.details.join(', '),
					unlockType: dailyData.unlockTypes.find((type) => type !== '') || '',
					...(dailyData.category !== undefined ? { category: dailyData.category } : {})
				}
				if (valueUnit === 'weekly_rate') unlockDay.events.push({ ...calendarEvent, unit: 'week' })
				else unlockDay.events.push(calendarEvent)
			}
		}
	}

	const currentYear = new Date().getUTCFullYear()
	for (let year = currentYear - 1; year <= currentYear + 2; year++) {
		for (let month = 0; month < 12; month++) {
			precomputedData.monthlyMaxValues[`${year}-${month.toString().padStart(2, '0')}`] = 0
		}
	}

	const now = new Date()
	const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	const listWindowEvents = new Array<Array<{ date: string; event: CalendarUnlockEvent }>>(6)
	for (let windowIndex = 0; windowIndex < 6; windowIndex++) {
		const start = new Date(todayUtcMs + windowIndex * 30 * 86_400_000)
		const startKey = start.toISOString().slice(0, 10)
		const events: Array<{ date: string; event: CalendarUnlockEvent }> = []
		listWindowEvents[windowIndex] = events
		precomputedData.listEvents[startKey] = events
	}

	for (const dateStr in unlocksData) {
		const dailyData = unlocksData[dateStr]!
		dailyData.events = dailyData.events.toSorted((a, b) => {
			const aIsWeeklyRate = isWeeklyRateCalendarEvent(a)
			const bIsWeeklyRate = isWeeklyRateCalendarEvent(b)
			if (aIsWeeklyRate !== bIsWeeklyRate) return aIsWeeklyRate ? 1 : -1
			return b.value - a.value
		})

		const year = Number(dateStr.slice(0, 4))
		const month = Number(dateStr.slice(5, 7)) - 1
		if (year >= currentYear - 1 && year <= currentYear + 2 && month >= 0 && month < 12) {
			const monthKey = `${year}-${month.toString().padStart(2, '0')}`
			if (dailyData.totalValue > precomputedData.monthlyMaxValues[monthKey]!) {
				precomputedData.monthlyMaxValues[monthKey] = dailyData.totalValue
			}
		}

		const dateMs = Date.parse(`${dateStr}T00:00:00Z`)
		const dayOffset = Math.floor((dateMs - todayUtcMs) / 86_400_000)
		if (dayOffset >= 0 && dayOffset < 180) {
			const windowEvents = listWindowEvents[Math.floor(dayOffset / 30)]!
			for (const event of dailyData.events) windowEvents.push({ date: dateStr, event })
		}
	}
	for (const events of listWindowEvents) events.sort((a, b) => a.date.localeCompare(b.date))

	// Precompute chart payloads for the current week/month so the client can render MultiSeriesChart
	// without recomputing on first paint (still falls back to client computation for filtered views).
	const weekStart = dayjs.utc().startOf('week')
	const weekKey = weekStart.format('YYYY-MM-DD')
	const weekDates = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'))
	precomputedData.weekCharts[weekKey] = buildUnlocksMultiSeriesChartForDateRange({
		dates: weekDates,
		unlocksData
	})

	const monthStart = dayjs.utc().startOf('month')
	const daysInMonth = monthStart.endOf('month').date()
	const monthDates = Array.from({ length: daysInMonth }, (_, i) => monthStart.date(i + 1).format('YYYY-MM-DD'))
	const monthKey = `${monthStart.year()}-${monthStart.month().toString().padStart(2, '0')}`
	precomputedData.monthCharts[monthKey] = buildUnlocksMultiSeriesChartForDateRange({
		dates: monthDates,
		unlocksData
	})

	return { unlocksData, precomputedData }
}

const getAllProtocolEmissionsWithHistory = async ({
	startDate,
	endDate,
	tokenlist
}: {
	startDate?: number
	endDate?: number
	tokenlist?: UnlockTokenlist
} = {}) => {
	const protocols = await fetchAllProtocolEmissions()

	const coinPrices = await fetchCurrentUnlockPrices({
		protocols,
		...(tokenlist !== undefined ? { tokenlist } : {})
	})

	const rows: Array<ProtocolEmission & { tPrice: number | null; tSymbol: string | null }> = []
	for (const protocol of protocols) {
		let events = protocol.events
		if (startDate !== undefined || endDate !== undefined) {
			events = []
			for (const event of protocol.events) {
				if (startDate !== undefined && event.timestamp < startDate) continue
				if (endDate !== undefined && event.timestamp > endDate) continue
				events.push(event)
			}
		}

		const coin = protocol.gecko_id ? coinPrices[`coingecko:${protocol.gecko_id}`] : undefined
		rows.push({
			...protocol,
			events,
			tPrice: coin?.price ?? null,
			tSymbol: coin?.symbol ?? null
		})
	}
	rows.sort((a, b) => {
		const x = a.events[0]?.timestamp
		const y = b.events[0]?.timestamp
		if (x === y) return 0
		if (x == null) return 1
		if (y == null) return -1
		return x < y ? -1 : 1
	})
	return rows
}

export type EnrichedProtocolEmission = Omit<ProtocolEmission, 'unlockEvents'> & {
	unlockEvents: null
	upcomingEvent: Array<EmissionEvent>
	events: Array<EmissionEvent>
	tPrice: number | null
	historicalPrice: Array<[number, number]>
	lastEvent: Array<EmissionEvent>
	tSymbol: string | null
	next24h: ProtocolEmissionNext24h
}

type UnlockHistoricalPricesByCoin = Record<string, { prices?: Array<{ timestamp: number; price: number }> }>

export const getAllProtocolEmissions = async ({
	startDate,
	endDate,
	getHistoricalPrices = true,
	tokenlist,
	emissionsHistoricalPrices
}: {
	startDate?: number
	endDate?: number
	getHistoricalPrices?: boolean
	tokenlist?: UnlockTokenlist
	emissionsHistoricalPrices?: IEmissionsHistoricalPrices
} = {}) => {
	const protocols = await fetchAllProtocolEmissions()
	const nowSec = Date.now() / 1000

	const coinPrices = await fetchCurrentUnlockPrices({
		protocols,
		...(tokenlist !== undefined ? { tokenlist } : {})
	})
	const { priceReqs, hasPriceRequests, lastPastTimestampByCoinKey } = buildUnlocksHistoricalPriceRequests(
		protocols,
		nowSec
	)
	let historicalPrices: UnlockHistoricalPricesByCoin = {}
	if (getHistoricalPrices) {
		if (emissionsHistoricalPrices !== undefined) {
			for (const coin in emissionsHistoricalPrices) {
				const prices = emissionsHistoricalPrices[coin]
				if (prices !== undefined) historicalPrices[coin] = prices
			}
		}

		if (hasPriceRequests) {
			const missingPriceReqs: Record<string, Array<number>> = {}
			let hasMissingPriceRequests = false

			for (const coin in priceReqs) {
				if (historicalPrices[coin]?.prices?.length) continue
				const requests = priceReqs[coin]
				if (requests === undefined) continue
				missingPriceReqs[coin] = requests
				hasMissingPriceRequests = true
			}

			if (hasMissingPriceRequests) {
				Object.assign(historicalPrices, (await batchFetchHistoricalPrices(missingPriceReqs)).results)
			}
		}
	}

	const rows: Array<EnrichedProtocolEmission> = []
	for (const protocol of protocols) {
		const geckoId = protocol.gecko_id
		const coinKey = geckoId ? `coingecko:${geckoId}` : null

		const events = protocol.events
		const next24h = protocol.next24h ?? getEmissionAmountBreakdownOverInterval(events, nowSec, nowSec + 24 * 60 * 60)

		// Keep unknown amounts and linear rate stops visible. Skip only known zero cliffs,
		// which do not represent a release or rate transition.
		let upcomingTimestamp: number | null = null
		for (const e of events) {
			const ts = e.timestamp
			if (ts < nowSec) continue
			if (e.unlockType === 'cliff' && !isUnknownEmissionEvent(e) && e.noOfTokens[0] <= 0) continue
			if (upcomingTimestamp === null || ts < upcomingTimestamp) upcomingTimestamp = ts
		}

		const upcomingEvent: Array<EmissionEvent> = []
		if (upcomingTimestamp !== null) {
			for (const event of events) {
				if (event.timestamp === upcomingTimestamp) upcomingEvent.push(event)
			}
		}

		const lastPastTimestamp = coinKey ? lastPastTimestampByCoinKey.get(coinKey) : undefined
		const lastEvent: Array<EmissionEvent> = []
		if (lastPastTimestamp !== undefined) {
			for (const event of events) {
				if (
					event.timestamp === lastPastTimestamp &&
					!isUnknownEmissionEvent(event) &&
					event.category !== 'noncirculating' &&
					event.category !== 'farming'
				) {
					lastEvent.push(event)
				}
			}
		}

		let filteredEvents = events
		if (startDate !== undefined || endDate !== undefined) {
			filteredEvents = []
			for (const event of events) {
				if (startDate !== undefined && event.timestamp < startDate) continue
				if (endDate !== undefined && event.timestamp > endDate) continue
				filteredEvents.push(event)
			}
		}

		const coin = coinKey ? coinPrices[coinKey] : null
		const aggregatePrice = protocol.tokenPrice?.[0]
		const tPrice = aggregatePrice && aggregatePrice.price > 0 ? aggregatePrice.price : (coin?.price ?? null)
		const tSymbol = aggregatePrice?.symbol ?? coin?.symbol ?? null
		const historicalPrice = coinKey ? historicalPrices[coinKey] : null

		const formattedHistoricalPrice: Array<[number, number]> = []
		if (lastEvent.length > 0 && historicalPrice?.prices) {
			for (const price of historicalPrice.prices) {
				formattedHistoricalPrice.push([price.timestamp * 1000, price.price])
			}
		}

		rows.push({
			...protocol,
			// Reduce payload without mutating original object
			unlockEvents: null,
			upcomingEvent,
			events: filteredEvents,
			tPrice,
			historicalPrice: formattedHistoricalPrice,
			lastEvent,
			tSymbol,
			next24h
		})
	}
	rows.sort((a, b) => {
		const x = a.upcomingEvent?.[0]?.timestamp
		const y = b.upcomingEvent?.[0]?.timestamp
		// equal items sort equally
		if (x === y) {
			return 0
		}

		// nulls sort after anything else
		if (x == null) {
			return 1
		}
		if (y == null) {
			return -1
		}

		return x < y ? -1 : 1
	})
	return rows
}

const EMPTY_TBD_SECTIONS: Array<string> = []
const EMPTY_FORECAST_SECTIONS: Array<string> = []

function extractColorFromMap(res: ProtocolEmissionDetail): Record<string, string> {
	const sections = res.componentData?.sections
	if (!sections) return {}
	const colorFrom: Record<string, string> = {}
	for (const name in sections) {
		const source = sections[name]!.colorFrom
		if (source) colorFrom[name] = source
	}
	return colorFrom
}

export function createEmptyProtocolEmissionResult(): EmptyProtocolEmissionResult {
	return {
		chartData: { documented: [], realtime: [] },
		pieChartData: { documented: [], realtime: [] },
		stackColors: { documented: {}, realtime: {} },
		datasets: {
			documented: { source: [], dimensions: ['timestamp'] },
			realtime: { source: [], dimensions: ['timestamp'] }
		},
		chartsConfigs: { documented: [], realtime: [] },
		meta: null,
		notes: [],
		events: [],
		token: null,
		geckoId: null,
		upcomingEvent: [],
		tokenAllocation: {
			documented: EMPTY_TOKEN_ALLOCATION_SPLIT,
			realtime: EMPTY_TOKEN_ALLOCATION_SPLIT
		},
		futures: {},
		categories: { documented: [], realtime: [] },
		categoriesBreakdown: null,
		hallmarks: { documented: [], realtime: [] },
		name: null,
		tokenPrice: {},
		unlockUsdChart: null,
		tbdSections: EMPTY_TBD_SECTIONS,
		forecastSections: EMPTY_FORECAST_SECTIONS,
		insiders: { methodology: '', addresses: [] }
	}
}

export function isEmptyProtocolEmissionResult(
	result: ProtocolEmissionResult | null | undefined
): result is EmptyProtocolEmissionResult | null | undefined {
	return result == null || result.name === null
}

export const getProtocolEmissons = async (
	protocolName: string,
	options?: {
		emissionsProtocolsList?: Array<string>
		skipAvailabilityCheck?: boolean
		tokenlist?: UnlockTokenlist
	}
): Promise<ProtocolEmissionResult> => {
	const emptyResult = createEmptyProtocolEmissionResult()
	if (!protocolName) return emptyResult

	const shouldCheckAvailability = !options?.skipAvailabilityCheck
	if (
		shouldCheckAvailability &&
		options?.emissionsProtocolsList &&
		!options.emissionsProtocolsList.includes(protocolName)
	) {
		return emptyResult
	}

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return emptyResult

	const { metadata, name, futures } = res

	const documentedData = res.documentedData
	const realTimeData = res.realTimeData

	const documentedBuilt = buildEmissionsSeriesAndCategories(documentedData)
	const realtimeBuilt = buildEmissionsSeriesAndCategories(realTimeData)
	const emissionCategories = {
		documented: documentedBuilt.categories,
		realtime: realtimeBuilt.categories
	}
	const projectionModel = buildEmissionProjectionModel({
		chartSections: documentedBuilt.categories.concat(realtimeBuilt.categories),
		categoriesBreakdown: res.categories,
		sectionMetadata: res.componentData?.sections,
		seriesTbdSections: documentedBuilt.tbdSections.concat(realtimeBuilt.tbdSections),
		seriesForecastSections: documentedBuilt.forecastSections.concat(realtimeBuilt.forecastSections)
	})

	const chartData = {
		documented: seriesToChartRows(documentedBuilt.series),
		realtime: seriesToChartRows(realtimeBuilt.series)
	}

	const pieChartData = {
		documented: buildPieFromChart(chartData.documented),
		realtime: buildPieFromChart(chartData.realtime)
	}

	const colorFrom = extractColorFromMap(res)
	const stackColors = {
		documented: buildColorsForPie(pieChartData.documented, colorFrom),
		realtime: buildColorsForPie(pieChartData.realtime, colorFrom)
	}

	const events = metadata.events
	const nowSec = Date.now() / 1000

	const tokenKey = metadata.token
	const geckoId = res.gecko_id
		? res.gecko_id
		: tokenKey.startsWith('coingecko:')
			? tokenKey.slice('coingecko:'.length)
			: null
	const coinKey = tokenKey || (geckoId ? `coingecko:${geckoId}` : null)
	const tokenlistPrices = options?.tokenlist ?? (geckoId ? await fetchUnlockTokenlistPrices() : undefined)
	const tokenlistPrice = getTokenlistCurrentPrice(geckoId, tokenlistPrices)
	const prices: Record<string, UnlockCurrentPrice | undefined> =
		coinKey && !tokenlistPrice
			? await fetchCoinPricesBatched([coinKey], { searchWidth: '4h' }).catch((error) => {
					console.log(error)
					return {}
				})
			: {}

	const tokenPriceData = tokenlistPrice ?? (coinKey ? prices[coinKey] : undefined)
	const tokenPrice: { price?: number; symbol?: string } = {}
	if (isPositiveNumber(tokenPriceData?.price)) tokenPrice.price = tokenPriceData.price
	if (tokenPriceData?.symbol) tokenPrice.symbol = tokenPriceData.symbol
	const meta = buildProtocolEmissionResultMeta(res, nowSec, tokenPrice.price)

	const upcomingEvent: Array<EmissionEvent> = []
	let upcomingTimestamp: number | null = null
	for (const event of events) {
		if (event.timestamp < nowSec) continue
		if (event.unlockType === 'cliff' && !isUnknownEmissionEvent(event) && event.noOfTokens[0] <= 0) continue
		if (upcomingTimestamp === null || event.timestamp < upcomingTimestamp) upcomingTimestamp = event.timestamp
	}
	if (upcomingTimestamp !== null) {
		for (const event of events) {
			if (event.timestamp === upcomingTimestamp) upcomingEvent.push(event)
		}
	}

	if (protocolName === 'looksrare') {
		tokenPrice.symbol = 'LOOKS'
	}

	// Pre-build MultiSeriesChart-ready datasets so consumers don't duplicate this work.
	const datasets = {
		documented: buildEmissionsDataset(chartData.documented, emissionCategories.documented),
		realtime: buildEmissionsDataset(chartData.realtime, emissionCategories.realtime)
	}
	const chartsConfigs = {
		documented: buildEmissionsCharts(emissionCategories.documented, stackColors.documented),
		realtime: buildEmissionsCharts(emissionCategories.realtime, stackColors.realtime)
	}

	return {
		chartData,
		pieChartData,
		stackColors,
		datasets,
		chartsConfigs,
		meta,
		notes: metadata.notes ?? [],
		events,
		token: metadata.token,
		geckoId,
		upcomingEvent,
		tokenAllocation: {
			documented: documentedData.tokenAllocation,
			realtime: getTokenAllocation(realTimeData?.tokenAllocation)
		},
		futures: futures ?? {},
		categories: emissionCategories,
		categoriesBreakdown: projectionModel.categoriesBreakdown,
		hallmarks: {
			documented: documentedData.data.length > 0 ? [[nowSec, 'Today']] : [],
			realtime: realTimeData && realTimeData.data.length > 0 ? [[nowSec, 'Today']] : []
		},
		name,
		tokenPrice,
		unlockUsdChart: res.unlockUsdChart,
		tbdSections: projectionModel.tbdSections,
		forecastSections: projectionModel.forecastSections,
		insiders: {
			methodology: res.insiders?.methodology ?? '',
			addresses: res.insiders?.addresses ?? []
		}
	}
}
