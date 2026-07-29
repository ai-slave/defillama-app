import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchCoinPrices as fetchCoinPricesBatched } from '~/api/pricing'
import { DATASETS_SERVER_URL } from '~/constants'
import { buildUnlocksMultiSeriesChartForDateRange } from '~/containers/Unlocks/buildUnlocksMultiSeriesChart'
import type { PrecomputedData, UnlocksData } from '~/containers/Unlocks/calendarTypes'
import { batchFetchHistoricalPrices, capitalizeFirstLetter, getNDistinctColors, roundToNearestHalfHour } from '~/utils'
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
	TokenAllocationPayload,
	TokenAllocationSplit,
	TokenIncentiveChartPoint
} from './api.types'
import type { CalendarUnlockEvent } from './calendarTypes'
import { buildEmissionProjectionModel } from './emissionsChartData'
import type { ProtocolEmissionResult } from './types'

type UnlockTokenlistEntry = Pick<ITokenListEntry, 'current_price' | 'symbol'>
type UnlockTokenlist = Record<string, UnlockTokenlistEntry | undefined>
type UnlockCurrentPrice = {
	price?: number | null
	symbol?: string | null
}
const TOKEN_LIST_API_URL = `${DATASETS_SERVER_URL}/tokenlist/rankings.json`
let unlockTokenlistPromise: Promise<UnlockTokenlist> | null = null

function buildEmissionsDataset(chartData: Array<EmissionsChartRow>, stacks: string[]): EmissionsDataset {
	const source: EmissionsDataset['source'] = []
	for (const input of chartData) {
		const row = new Array<number | null>(stacks.length + 1)
		row[0] = input.timestamp
		for (let stackIndex = 0; stackIndex < stacks.length; stackIndex++) {
			const stack = stacks[stackIndex]
			if (stack === undefined) continue
			row[stackIndex + 1] = input[stack] ?? null
		}
		source.push(row)
	}
	return {
		source,
		dimensions: ['timestamp', ...stacks]
	}
}

function buildEmissionsCharts(stacks: string[], colors: Record<string, string>): EmissionsChartConfig {
	return stacks.map((name, index) => {
		const color = colors[name]
		return {
			type: 'line' as const,
			name,
			encode: { x: 0 as const, y: index + 1 },
			...(color !== undefined ? { color } : {}),
			stack: 'A'
		}
	})
}

function formatEmissionLabel(label: string | undefined): string {
	if (!label) return ''
	return label
		.split(' ')
		.map((l) => capitalizeFirstLetter(l))
		.join(' ')
}

function roundEmissionEvents(events: EmissionEvent[] | undefined | null): EmissionEvent[] {
	if (!events?.length) return []
	let roundedEvents: EmissionEvent[] | null = null
	for (let index = 0; index < events.length; index++) {
		const event = events[index]
		if (event === undefined) continue
		const timestamp = roundToNearestHalfHour(event.timestamp)
		if (timestamp === event.timestamp) {
			roundedEvents?.push(event)
			continue
		}
		if (!roundedEvents) roundedEvents = events.slice(0, index)
		roundedEvents.push({ ...event, timestamp })
	}
	return roundedEvents ?? events
}

const EMPTY_TOKEN_ALLOCATION_SPLIT: TokenAllocationSplit = {
	current: {},
	final: {}
}

function normalizeTokenAllocation(input: TokenAllocationPayload | null | undefined): TokenAllocationSplit {
	if (!input) return EMPTY_TOKEN_ALLOCATION_SPLIT
	if (isTokenAllocationSplit(input)) return input
	return { current: { ...input }, final: { ...input } }
}

function isTokenAllocationSplit(input: TokenAllocationPayload): input is TokenAllocationSplit {
	return typeof input.current === 'object' && typeof input.final === 'object'
}

function isPositiveNumber(value: number | null | undefined): value is number {
	return value != null && value > 0
}

function normalizeTokenlistSymbol(value: string): string | null {
	return value ? value.toUpperCase() : null
}

function projectUnlockTokenlist(rankings: IResponseCGTokenRankingsDatasetItem[]): UnlockTokenlist {
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

	unlockTokenlistPromise = fetchJson<IResponseCGTokenRankingsDatasetItem[]>(TOKEN_LIST_API_URL, {
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
	protocols: Array<{ gecko_id?: string | null }>
	tokenlist?: UnlockTokenlist
}): Promise<Record<string, UnlockCurrentPrice | undefined>> {
	const prices: Record<string, UnlockCurrentPrice | undefined> = {}
	const geckoIds = new Set<string>()

	for (const protocol of protocols) {
		const geckoId = protocol?.gecko_id
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
	categories: string[]
	tbdSections: string[]
	forecastSections: string[]
} {
	const series = new Map<number, Record<string, number | null>>()
	const categories: string[] = []
	const seen = new Set<string>()
	const tbdSections: string[] = []
	const forecastSections: string[] = []

	for (const emission of input?.data ?? []) {
		const label = formatEmissionLabel(emission.label)
		if (!label) continue

		if (!seen.has(label)) {
			seen.add(label)
			categories.push(label)
		}
		// Projection is a series-level property duplicated on every live API point.
		// Read the first point once instead of checking it in the row-construction loop.
		const firstValue = emission.data?.[0]
		if (firstValue?.isTBD) tbdSections.push(label)
		else if (firstValue?.isForecast) forecastSections.push(label)

		for (const value of emission.data ?? []) {
			const ts = value.timestamp
			let entry = series.get(ts)
			if (!entry) {
				const createdEntry: Record<string, number | null> = {}
				series.set(ts, createdEntry)
				entry = createdEntry
			}
			entry[label] = value.unlocked ?? null
		}
	}

	return { series, categories, tbdSections, forecastSections }
}

function seriesToChartRows(series: Map<number, Record<string, number | null>>): EmissionsChartRow[] {
	const rows: EmissionsChartRow[] = []
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

function buildPieFromChart(chart: EmissionsChartRow[]): Array<{ name: string; value: number }> {
	if (!chart.length) return []
	const last = chart[chart.length - 1]
	if (!last) return []
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
	const names = new Set(pie.map((p) => p.name))
	const baseNameCache = new Map<string, string>()
	const baseNameOf = (name: string): string => {
		const cached = baseNameCache.get(name)
		if (cached) return cached

		const visited: string[] = []
		const seen = new Set<string>()
		let current = name

		for (;;) {
			const next = colorFrom[current]
			if (!next || !names.has(next)) break
			if (seen.has(next)) {
				const cycle = [...visited, current, next].filter((item, index, arr) => arr.indexOf(item) === index)
				const cycleStart = cycle.toSorted()[0]
				if (!cycleStart) throw new Error('Emission color cycle is unexpectedly empty')
				current = cycleStart
				break
			}
			visited.push(current)
			seen.add(current)
			current = next
		}

		for (const visitedName of visited) {
			baseNameCache.set(visitedName, current)
		}
		baseNameCache.set(name, current)
		return current
	}
	const primary = pie.filter((p) => baseNameOf(p.name) === p.name)
	const palette = getNDistinctColors(primary.length)
	for (let index = 0; index < primary.length; index++) {
		const entry = primary[index]
		if (entry === undefined) continue
		const color = palette[index]
		if (!color) throw new Error(`Missing emission pie color at index ${index}`)
		colors[entry.name] = color
	}
	for (const p of pie) {
		if (colors[p.name]) continue
		const base = baseNameOf(p.name)
		const color = colors[base]
		if (color) colors[p.name] = color
	}
	return colors
}

export async function getProtocolUnlockUsdChart(protocolName: string): Promise<TokenIncentiveChartPoint[] | null> {
	const res = await fetchProtocolEmission(protocolName)
	return res?.unlockUsdChart ?? null
}

export async function getProtocolEmissionsCharts(protocolName: string): Promise<{
	chartData: {
		documented: Array<EmissionsChartRow>
		realtime: Array<EmissionsChartRow>
	}
	unlockUsdChart: TokenIncentiveChartPoint[] | null
}> {
	const empty = { chartData: { documented: [], realtime: [] }, unlockUsdChart: null }
	if (!protocolName) return empty

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return empty

	const documentedData = res.documentedData ?? {}
	const realTimeData = res.realTimeData ?? {}

	const documented = buildEmissionsSeriesAndCategories(documentedData).series
	const realtime = buildEmissionsSeriesAndCategories(realTimeData).series

	const documentedChart = seriesToChartRows(documented)
	const realtimeChart = seriesToChartRows(realtime)

	return {
		chartData: { documented: documentedChart, realtime: realtimeChart },
		unlockUsdChart: res.unlockUsdChart ?? null
	}
}

export async function getProtocolEmissionsScheduleData(protocolName: string): Promise<{
	datasets: { documented: EmissionsDataset; realtime: EmissionsDataset }
	chartsConfigs: { documented: EmissionsChartConfig; realtime: EmissionsChartConfig }
	categories: { documented: string[]; realtime: string[] }
	hallmarks: { documented: [number, string][]; realtime: [number, string][] }
}> {
	const empty = {
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

	const documentedBuilt = buildEmissionsSeriesAndCategories(res.documentedData ?? {})
	const realtimeBuilt = buildEmissionsSeriesAndCategories(res.realTimeData ?? {})
	const categories = { documented: documentedBuilt.categories, realtime: realtimeBuilt.categories }

	const documentedChart = seriesToChartRows(documentedBuilt.series)
	const realtimeChart = seriesToChartRows(realtimeBuilt.series)

	// Assign colors by category order to keep schedule charts fully colored.
	const documentedPalette = getNDistinctColors(categories.documented.length)
	const documentedColors: Record<string, string> = {}
	for (let index = 0; index < categories.documented.length; index++) {
		const category = categories.documented[index]
		if (category === undefined) continue
		const color = documentedPalette[index]
		if (!color) throw new Error(`Missing documented emission color at index ${index}`)
		documentedColors[category] = color
	}

	const realtimePalette = getNDistinctColors(categories.realtime.length)
	const realtimeColors: Record<string, string> = {}
	for (let index = 0; index < categories.realtime.length; index++) {
		const category = categories.realtime[index]
		if (category === undefined) continue
		const color = realtimePalette[index]
		if (!color) throw new Error(`Missing realtime emission color at index ${index}`)
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
	const documentedHasData = (res.documentedData?.data?.length ?? 0) > 0
	const realtimeHasData = (res.realTimeData?.data?.length ?? 0) > 0

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

interface ProtocolEmissionMeta {
	name?: string
	token?: string
	gecko_id?: string | null
	events?: EmissionEvent[] | null
	tPrice?: number | null
	tSymbol?: string | null
	totalLocked?: number | null
	maxSupply?: number | null
}

export async function getProtocolEmissionsPieData(protocolName: string): Promise<{
	pieChartData: {
		documented: Array<{ name: string; value: number }>
		realtime: Array<{ name: string; value: number }>
	}
	stackColors: { documented: Record<string, string>; realtime: Record<string, string> }
	meta: ProtocolEmissionMeta
}> {
	const empty = {
		pieChartData: { documented: [], realtime: [] },
		stackColors: { documented: {}, realtime: {} },
		meta: {}
	}

	const res = await fetchProtocolEmission(protocolName)
	if (!res) return empty

	const documentedBuilt = buildEmissionsSeriesAndCategories(res.documentedData ?? {})
	const realtimeBuilt = buildEmissionsSeriesAndCategories(res.realTimeData ?? {})

	const documentedChart = seriesToChartRows(documentedBuilt.series)
	const realtimeChart = seriesToChartRows(realtimeBuilt.series)

	const pieChartData = {
		documented: buildPieFromChart(documentedChart),
		realtime: buildPieFromChart(realtimeChart)
	}
	const colorFromMap = extractColorFromMap(res)
	const stackColors = {
		documented: buildColorsForPie(pieChartData.documented, colorFromMap),
		realtime: buildColorsForPie(pieChartData.realtime, colorFromMap)
	}

	const allEmissions = await fetchAllProtocolEmissions()
	const meta = allEmissions.find((p) => p?.token === res?.metadata?.token) ?? {}

	return { pieChartData, stackColors, meta }
}

type UnlockCalendarProtocolEvent = {
	timestamp: number
	noOfTokens: number[]
	description?: string
	category?: string
}

export function buildUnlockTypesByTimestamp(
	allEventsForProtocol: readonly UnlockCalendarProtocolEvent[]
): Map<number, string> {
	const nowSec = Math.floor(Date.now() / 1000)
	const unlockTypes = new Map<number, string>()
	// The emissions API contract is timestamp-ascending. Filtering preserves that
	// order, so classify adjacent future events without copying or re-sorting.
	let event: UnlockCalendarProtocolEvent | undefined
	for (const nextEvent of allEventsForProtocol) {
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
	const isBetweenPlugin = (await import('dayjs/plugin/isBetween')).default
	dayjs.extend(isBetweenPlugin)

	const data = await getAllProtocolEmissionsWithHistory()
	const unlocksData: UnlocksData = {}

	const precomputedData: Required<PrecomputedData> = {
		monthlyMaxValues: {},
		listEvents: {},
		weekCharts: {},
		monthCharts: {}
	}

	for (const protocol of data ?? []) {
		if (!protocol?.events || protocol.tPrice == null) continue

		const validEvents = protocol.events.filter((event: EmissionEvent) => event.noOfTokens.length > 0)
		const unlockTypesByTimestamp = buildUnlockTypesByTimestamp(validEvents)

		const protocolUnlocksByDate: Record<
			string,
			{ value: number; details: string[]; unlockTypes: string[]; category?: string }
		> = {}

		for (const event of validEvents) {
			let totalTokens = 0
			for (const amount of event.noOfTokens) totalTokens += amount
			if (totalTokens === 0) continue

			const valueUSD = totalTokens * protocol.tPrice
			const dateStr = new Date(event.timestamp * 1000).toISOString().slice(0, 10)
			const unlockType = unlockTypesByTimestamp.get(event.timestamp) ?? ''

			const entry =
				protocolUnlocksByDate[dateStr] ??
				(protocolUnlocksByDate[dateStr] = { value: 0, details: [], unlockTypes: [], category: event.category || '' })

			entry.value += valueUSD
			entry.details.push(event.description || 'Token unlock')
			entry.unlockTypes.push(unlockType)
			if (event.category) entry.category = event.category
		}

		for (const dateStr in protocolUnlocksByDate) {
			const dailyData = protocolUnlocksByDate[dateStr]
			if (dailyData === undefined) continue
			const unlockDay = unlocksData[dateStr] ?? { totalValue: 0, events: [] }
			unlocksData[dateStr] = unlockDay

			unlockDay.totalValue += dailyData.value
			unlockDay.events.push({
				protocol: protocol.name,
				value: dailyData.value,
				details: dailyData.details.join(', '),
				unlockType: dailyData.unlockTypes.find((type) => type !== '') || '',
				...(dailyData.category !== undefined ? { category: dailyData.category } : {})
			})
		}
	}

	const unlockEntries: Array<[string, UnlocksData[string]]> = []
	for (const dateStr in unlocksData) {
		const dailyData = unlocksData[dateStr]
		if (dailyData === undefined) continue
		dailyData.events = dailyData.events.toSorted((a, b) => b.value - a.value)
		unlockEntries.push([dateStr, dailyData])
	}
	const currentYear = new Date().getFullYear()
	for (let year = currentYear - 1; year <= currentYear + 2; year++) {
		for (let month = 0; month < 12; month++) {
			const startOfMonth = dayjs().year(year).month(month).startOf('month')
			const endOfMonth = startOfMonth.endOf('month')
			const monthKey = `${year}-${month.toString().padStart(2, '0')}`

			let maxValue = 0
			for (const [dateStr, dailyData] of unlockEntries) {
				const date = dayjs(dateStr)
				if (date.isBetween(startOfMonth.subtract(1, 'day'), endOfMonth.add(1, 'day'))) {
					if (dailyData.totalValue > maxValue) maxValue = dailyData.totalValue
				}
			}

			precomputedData.monthlyMaxValues[monthKey] = maxValue
		}
	}

	const now = dayjs()
	for (let i = 0; i < 6; i++) {
		const startDate = now.add(i * 30, 'days').startOf('day')
		const endDate = startDate.add(30, 'days')
		const startDateKey = startDate.format('YYYY-MM-DD')

		const events: Array<{ date: string; event: CalendarUnlockEvent }> = []
		for (const [dateStr, dailyData] of unlockEntries) {
			const date = dayjs(dateStr)
			if (date.isBetween(startDate.subtract(1, 'day'), endDate)) {
				for (const event of dailyData.events) events.push({ date: dateStr, event })
			}
		}

		precomputedData.listEvents[startDateKey] = events.toSorted(
			(a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
		)
	}

	// Precompute chart payloads for the current week/month so the client can render MultiSeriesChart
	// without recomputing on first paint (still falls back to client computation for filtered views).
	const weekStart = dayjs().startOf('week')
	const weekKey = weekStart.format('YYYY-MM-DD')
	const weekDates = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'))
	precomputedData.weekCharts[weekKey] = buildUnlocksMultiSeriesChartForDateRange({
		dates: weekDates,
		unlocksData
	})

	const monthStart = dayjs().startOf('month')
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
	try {
		const protocols = await fetchAllProtocolEmissions()

		const coinPrices = await fetchCurrentUnlockPrices({
			protocols,
			...(tokenlist !== undefined ? { tokenlist } : {})
		})

		return protocols
			.map((protocol: ProtocolEmission) => {
				try {
					let filteredEvents = protocol.events || []
					if (startDate) {
						filteredEvents = filteredEvents.filter((e: EmissionEvent) => e.timestamp >= startDate)
					}
					if (endDate) {
						filteredEvents = filteredEvents.filter((e: EmissionEvent) => e.timestamp <= endDate)
					}

					const coin = coinPrices[`coingecko:${protocol.gecko_id}`]

					return {
						...protocol,
						events: filteredEvents,
						tPrice: coin?.price ?? null,
						tSymbol: coin?.symbol ?? null
					}
				} catch (e) {
					console.log('error', protocol.name, e)
					return null
				}
			})
			.filter(<T>(x: T | null): x is T => x !== null)
			.sort((a, b) => {
				const x = a.events?.[0]?.timestamp
				const y = b.events?.[0]?.timestamp
				if (x === y) return 0
				if (x == null) return 1
				if (y == null) return -1
				return x < y ? -1 : 1
			})
	} catch (e) {
		console.log(e)
		return []
	}
}

type EnrichedProtocolEmission = ProtocolEmission & {
	unlockEvents: null
	upcomingEvent: EmissionEvent[]
	events: EmissionEvent[]
	tPrice: number | null
	historicalPrice: Array<[number, number]>
	lastEvent: EmissionEvent[]
	tSymbol: string | null
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
	try {
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
				const missingPriceReqs: Record<string, number[]> = {}
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

		const rows: EnrichedProtocolEmission[] = []
		for (const protocol of protocols) {
			try {
				const geckoId = protocol?.gecko_id
				const coinKey = geckoId ? `coingecko:${geckoId}` : null

				const events = roundEmissionEvents(protocol.events)

				// Upcoming event: choose the earliest upcoming event with non-zero tokens.
				let upcomingTimestamp: number | null = null
				for (const e of events) {
					const ts = e.timestamp
					if (ts < nowSec) continue
					if (e.hasUnknownTokenAmount) continue
					if (e?.noOfTokens?.length === 1 && e.noOfTokens[0] === 0) continue
					if (upcomingTimestamp === null || ts < upcomingTimestamp) upcomingTimestamp = ts
				}

				const upcomingEvent: EmissionEvent[] = []
				if (upcomingTimestamp !== null) {
					for (const event of events) {
						if (event.timestamp === upcomingTimestamp && !event.hasUnknownTokenAmount) {
							upcomingEvent.push(event)
						}
					}
				}

				const lastPastTimestamp = coinKey ? lastPastTimestampByCoinKey.get(coinKey) : undefined
				const lastEvent: EmissionEvent[] = []
				if (typeof lastPastTimestamp === 'number') {
					for (const event of events) {
						if (
							event.timestamp === lastPastTimestamp &&
							!event.hasUnknownTokenAmount &&
							event.category !== 'noncirculating' &&
							event.category !== 'farming'
						) {
							lastEvent.push(event)
						}
					}
				}

				let filteredEvents = events
				if (startDate) filteredEvents = filteredEvents.filter((e: EmissionEvent) => e.timestamp >= startDate)
				if (endDate) filteredEvents = filteredEvents.filter((e: EmissionEvent) => e.timestamp <= endDate)

				const coin = coinKey ? coinPrices[coinKey] : null
				const tSymbol = coin?.symbol ?? null
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
					tPrice: coin?.price ?? null,
					historicalPrice: formattedHistoricalPrice,
					lastEvent,
					tSymbol
				})
			} catch (e) {
				console.log('error', protocol.name, e)
			}
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
	} catch (e) {
		console.log(e)
		return []
	}
}

const EMPTY_TBD_SECTIONS: string[] = []
const EMPTY_FORECAST_SECTIONS: string[] = []

function extractColorFromMap(res: ProtocolEmissionDetail): Record<string, string> {
	const sections = res.componentData?.sections
	if (!sections) return {}
	const map: Record<string, string> = {}
	for (const name in sections) {
		const section: (typeof sections)[string] | undefined = sections[name]
		const target = section?.colorFrom
		if (typeof target === 'string' && target && target !== name && sections[target]) {
			map[name] = target
		}
	}
	return map
}

export function createEmptyProtocolEmissionResult(): ProtocolEmissionResult {
	return {
		chartData: { documented: [], realtime: [] },
		pieChartData: { documented: [], realtime: [] },
		stackColors: { documented: {}, realtime: {} },
		datasets: {
			documented: { source: [], dimensions: ['timestamp'] },
			realtime: { source: [], dimensions: ['timestamp'] }
		},
		chartsConfigs: { documented: [], realtime: [] },
		meta: {},
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

export function isEmptyProtocolEmissionResult(result: ProtocolEmissionResult | null | undefined): boolean {
	if (!result) return true

	return (
		result.categories.documented.length === 0 && result.categories.realtime.length === 0 && result.events.length === 0
	)
}

export const getProtocolEmissons = async (
	protocolName: string,
	options?: {
		emissionsProtocolsList?: string[]
		skipAvailabilityCheck?: boolean
		tokenlist?: UnlockTokenlist
	}
): Promise<ProtocolEmissionResult> => {
	try {
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

		const [res, allEmissions] = await Promise.all([
			fetchProtocolEmission(protocolName),
			fetchAllProtocolEmissions().catch(() => [])
		])

		if (!res) return emptyResult

		const { metadata, name, futures } = res

		const documentedData = res.documentedData ?? {}
		const realTimeData = res.realTimeData ?? {}

		const documentedBuilt = buildEmissionsSeriesAndCategories(documentedData)
		const realtimeBuilt = buildEmissionsSeriesAndCategories(realTimeData)
		const emissionCategories = { documented: documentedBuilt.categories, realtime: realtimeBuilt.categories }
		const projectionModel = buildEmissionProjectionModel({
			chartSections: documentedBuilt.categories.concat(realtimeBuilt.categories),
			categoriesBreakdown: res.categories ?? null,
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

		const colorFromMap = extractColorFromMap(res)
		const stackColors = {
			documented: buildColorsForPie(pieChartData.documented, colorFromMap),
			realtime: buildColorsForPie(pieChartData.realtime, colorFromMap)
		}

		const roundedEvents = roundEmissionEvents(metadata?.events)
		const nowSec = Date.now() / 1000

		const tokenKey = metadata?.token
		const geckoId =
			typeof res?.gecko_id === 'string' && res.gecko_id
				? res.gecko_id
				: typeof tokenKey === 'string' && tokenKey.startsWith('coingecko:')
					? tokenKey.slice('coingecko:'.length)
					: null
		const coinKey = typeof tokenKey === 'string' && tokenKey ? tokenKey : geckoId ? `coingecko:${geckoId}` : null
		const tokenlistPrices = options?.tokenlist ?? (geckoId ? await fetchUnlockTokenlistPrices() : undefined)
		const tokenlistPrice = getTokenlistCurrentPrice(geckoId, tokenlistPrices)
		const prices: Record<string, UnlockCurrentPrice | undefined> =
			coinKey && !tokenlistPrice
				? await fetchCoinPricesBatched([coinKey], { searchWidth: '4h' }).catch((err) => {
						console.log(err)
						return {}
					})
				: {}

		const tokenPriceData = tokenlistPrice ?? (coinKey ? prices[coinKey] : undefined)
		const tokenPrice: { price?: number; symbol?: string } = {}
		if (isPositiveNumber(tokenPriceData?.price)) tokenPrice.price = tokenPriceData.price
		if (typeof tokenPriceData?.symbol === 'string' && tokenPriceData.symbol) tokenPrice.symbol = tokenPriceData.symbol

		let upcomingEvent: EmissionEvent[] = []
		if (roundedEvents.length > 0) {
			const event = roundedEvents.find(
				(e) =>
					e.timestamp >= nowSec && !e.hasUnknownTokenAmount && !(e.noOfTokens.length === 1 && e.noOfTokens[0] === 0)
			)

			if (event) {
				upcomingEvent = roundedEvents.filter((e) => e.timestamp === event.timestamp && !e.hasUnknownTokenAmount)
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
			meta: allEmissions?.find((p) => p?.token === metadata?.token) ?? {},
			notes: metadata?.notes ?? [],
			events: roundedEvents,
			token: metadata?.token ?? null,
			geckoId,
			upcomingEvent,
			tokenAllocation: {
				documented: normalizeTokenAllocation(documentedData.tokenAllocation),
				realtime: normalizeTokenAllocation(realTimeData.tokenAllocation)
			},
			futures: futures ?? {},
			categories: emissionCategories,
			categoriesBreakdown: projectionModel.categoriesBreakdown,
			hallmarks: {
				documented: (documentedData.data?.length ?? 0) > 0 ? [[nowSec, 'Today']] : [],
				realtime: (realTimeData.data?.length ?? 0) > 0 ? [[nowSec, 'Today']] : []
			},
			name: name || null,
			tokenPrice,
			unlockUsdChart: res.unlockUsdChart ?? null,
			tbdSections: projectionModel.tbdSections,
			forecastSections: projectionModel.forecastSections,
			insiders: {
				methodology: res.insiders?.methodology ?? '',
				addresses: res.insiders?.addresses ?? []
			}
		}
	} catch (e) {
		console.log(e)
		return createEmptyProtocolEmissionResult()
	}
}
