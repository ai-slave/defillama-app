import { COINGECKO_KEY, COINS_CHART_API, DATASETS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import { getObjectCache, setObjectCache } from '~/utils/cache-client'
import type { PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import type {
	CgChartResponse,
	CgMarketChartResponse,
	CoinGeckoCoinDetailResultForOptions,
	CoinGeckoCoinListItem,
	CoinGeckoCoinDetailResponseForOptions,
	CoinGeckoExchange,
	CoinGeckoSimplePriceResponse,
	DenominationPriceHistory,
	FetchCoinGeckoCoinByIdOptions,
	FetchCoinGeckoCoinsListOptions,
	FetchCoinGeckoCoinMarketChartByIdOptions,
	FetchCoinGeckoExchangesOptions,
	FetchCoinGeckoSimplePriceOptions,
	GeckoIdResponse,
	IResponseCGTokenRankingsDatasetItem
} from './coingecko.types'

const COINGECKO_API_BASE_URL = COINGECKO_KEY
	? 'https://pro-api.coingecko.com/api/v3'
	: 'https://api.coingecko.com/api/v3'

const COINGECKO_REQUEST_HEADERS = COINGECKO_KEY ? { 'x-cg-pro-api-key': COINGECKO_KEY } : undefined
const TOKEN_LIST_API_URL = `${DATASETS_SERVER_URL}/tokenlist/rankings.json`
const COINGECKO_EXCHANGES_MAX_PAGE_SIZE = 250
const CG_CHART_CACHE_TTL_SECONDS = 60 * 60
const CG_CHART_LOCAL_API_PATH = '/api/public/tokens/charts/coingecko'

function createCoinGeckoUrl(pathname: string): URL {
	return new URL(pathname.replace(/^\//, ''), `${COINGECKO_API_BASE_URL}/`)
}

function setQueryParam(
	url: URL,
	key: string,
	value: string | number | boolean | Array<string> | undefined | null
): void {
	if (value === undefined || value === null) return
	if (Array.isArray(value)) {
		if (value.length === 0) return
		url.searchParams.set(key, value.join(','))
		return
	}
	url.searchParams.set(key, String(value))
}

async function fetchCoinGeckoJson<T>(pathname: string, url: URL = createCoinGeckoUrl(pathname)): Promise<T> {
	return fetchJson<T>(url.toString(), COINGECKO_REQUEST_HEADERS ? { headers: COINGECKO_REQUEST_HEADERS } : undefined)
}

async function fetchAllPaginatedCoinGeckoResults<T>({
	fetchPage,
	pageSize,
	breakOnPartialPage = true,
	maxPages
}: {
	fetchPage: (page: number) => Promise<Array<T>>
	pageSize: number
	breakOnPartialPage?: boolean
	maxPages: number
}): Promise<Array<T>> {
	const results: Array<T> = []
	const safeMaxPages = Math.max(1, maxPages)
	let terminated = false

	for (let page = 1; page <= safeMaxPages; page++) {
		const pageItems = await fetchPage(page)
		if (pageItems.length === 0) {
			terminated = true
			break
		}

		results.push(...pageItems)

		if (breakOnPartialPage && pageItems.length < pageSize) {
			terminated = true
			break
		}
	}

	if (!terminated) {
		throw new Error(
			`[fetchAllPaginatedCoinGeckoResults] Reached maxPages=${safeMaxPages} without termination (pageSize=${pageSize}, breakOnPartialPage=${breakOnPartialPage})`
		)
	}

	return results
}

/**
 * Fetch the ranked CoinGecko token market list from the DefiLlama datasets mirror.
 * This is not a direct CoinGecko API call.
 */
export async function fetchCoinGeckoTokensListFromDataset(): Promise<Array<IResponseCGTokenRankingsDatasetItem>> {
	return fetchJson<Array<IResponseCGTokenRankingsDatasetItem>>(TOKEN_LIST_API_URL)
}

/**
 * Fetch all pages from CoinGecko GET /exchanges.
 * This endpoint documents `page` and `per_page`, so callers receive the combined result set.
 */
export async function fetchCoinGeckoExchanges({
	perPage = COINGECKO_EXCHANGES_MAX_PAGE_SIZE,
	maxPages = 1000
}: FetchCoinGeckoExchangesOptions = {}): Promise<Array<CoinGeckoExchange>> {
	const pageSize = Math.min(Math.max(1, perPage), COINGECKO_EXCHANGES_MAX_PAGE_SIZE)

	return fetchAllPaginatedCoinGeckoResults<CoinGeckoExchange>({
		pageSize,
		maxPages,
		fetchPage: async (page) => {
			const url = createCoinGeckoUrl('/exchanges')
			setQueryParam(url, 'per_page', pageSize)
			setQueryParam(url, 'page', page)
			return fetchCoinGeckoJson<Array<CoinGeckoExchange>>(url.pathname, url)
		}
	})
}

/** Fetch CoinGecko GET /coins/list with optional platforms included. */
export async function fetchCoinGeckoCoinsList({
	includePlatform = false,
	status = 'active'
}: FetchCoinGeckoCoinsListOptions = {}): Promise<Array<CoinGeckoCoinListItem>> {
	const url = createCoinGeckoUrl('/coins/list')
	setQueryParam(url, 'include_platform', includePlatform)
	setQueryParam(url, 'status', status)
	return fetchCoinGeckoJson<Array<CoinGeckoCoinListItem>>(url.pathname, url)
}
/** Fetch CoinGecko simple prices by ids, names, or symbols. */
export async function fetchCoinGeckoSimplePrice({
	vsCurrencies,
	ids,
	names,
	symbols,
	includeTokens,
	includeMarketCap,
	include24hrVol,
	include24hrChange,
	includeLastUpdatedAt,
	precision
}: FetchCoinGeckoSimplePriceOptions): Promise<CoinGeckoSimplePriceResponse> {
	const url = createCoinGeckoUrl('/simple/price')
	setQueryParam(url, 'vs_currencies', vsCurrencies)
	setQueryParam(url, 'ids', ids)
	setQueryParam(url, 'names', names)
	setQueryParam(url, 'symbols', symbols)
	setQueryParam(url, 'include_tokens', includeTokens)
	setQueryParam(url, 'include_market_cap', includeMarketCap)
	setQueryParam(url, 'include_24hr_vol', include24hrVol)
	setQueryParam(url, 'include_24hr_change', include24hrChange)
	setQueryParam(url, 'include_last_updated_at', includeLastUpdatedAt)
	setQueryParam(url, 'precision', precision)
	return fetchCoinGeckoJson<CoinGeckoSimplePriceResponse>(url.pathname, url)
}

/** Fetch the CoinGecko coin payload by asset platform and contract address. */
async function fetchCoinGeckoCoinByContractAddress(
	assetPlatformId: string,
	contractAddress: string
): Promise<CoinGeckoCoinDetailResponseForOptions | null> {
	if (!assetPlatformId || !contractAddress) return null

	return fetchCoinGeckoJson<CoinGeckoCoinDetailResponseForOptions>(
		`/coins/${encodeURIComponent(assetPlatformId)}/contract/${encodeURIComponent(contractAddress)}`
	).catch(() => null)
}

/**
 * Resolve a CoinGecko coin id from a `chain:address` token reference.
 * For `coingecko:<id>` inputs, the CoinGecko id is returned directly without a network call.
 */
export async function fetchCoinGeckoIdByAddress(addressData: string): Promise<GeckoIdResponse | null> {
	const [chain, address] = addressData.split(':')
	if (!chain || !address || address === '-') return null

	if (chain === 'coingecko') return { id: address }

	const coin = await fetchCoinGeckoCoinByContractAddress(chain, address)
	return coin?.id ? { id: coin.id } : null
}

const DEFAULT_FETCH_COIN_DETAIL_OPTIONS: Required<FetchCoinGeckoCoinByIdOptions> = {
	localization: true,
	tickers: true,
	marketData: true,
	communityData: true,
	developerData: true,
	sparkline: false,
	includeCategoriesDetails: false,
	dexPairFormat: 'contract_address'
}

function createCoinGeckoCoinByIdUrl(geckoId: string, options?: FetchCoinGeckoCoinByIdOptions): URL {
	const query = { ...DEFAULT_FETCH_COIN_DETAIL_OPTIONS, ...options }
	const url = createCoinGeckoUrl(`/coins/${encodeURIComponent(geckoId)}`)
	setQueryParam(url, 'localization', query.localization)
	setQueryParam(url, 'tickers', query.tickers)
	setQueryParam(url, 'market_data', query.marketData)
	setQueryParam(url, 'community_data', query.communityData)
	setQueryParam(url, 'developer_data', query.developerData)
	setQueryParam(url, 'sparkline', query.sparkline)
	setQueryParam(url, 'include_categories_details', query.includeCategoriesDetails)
	setQueryParam(url, 'dex_pair_format', query.dexPairFormat)
	return url
}

/**
 * Fetch CoinGecko coin metadata from GET /coins/{id} and propagate upstream errors.
 * Use this when missing data and upstream failures need different route behavior.
 */
export async function fetchCoinGeckoCoinByIdOrThrow<
	TOptions extends FetchCoinGeckoCoinByIdOptions | undefined = undefined
>(geckoId: string, options?: TOptions): Promise<CoinGeckoCoinDetailResponseForOptions<TOptions>> {
	if (!geckoId) throw new Error('[fetchCoinGeckoCoinByIdOrThrow] geckoId is required')

	const url = createCoinGeckoCoinByIdUrl(geckoId, options)
	return fetchCoinGeckoJson<CoinGeckoCoinDetailResponseForOptions<TOptions>>(url.pathname, url)
}

/**
 * Fetch CoinGecko coin metadata from GET /coins/{id}.
 * Query flags control which optional sections CoinGecko includes in the response body.
 */
export async function fetchCoinGeckoCoinById<TOptions extends FetchCoinGeckoCoinByIdOptions | undefined = undefined>(
	geckoId: string,
	options?: TOptions
): Promise<CoinGeckoCoinDetailResultForOptions<TOptions>> {
	if (!geckoId) return null

	return fetchCoinGeckoCoinByIdOrThrow(geckoId, options).catch(() => null)
}
/** Fetch CoinGecko historical market chart data from GET /coins/{id}/market_chart. */
async function fetchCoinGeckoCoinMarketChartById(
	geckoId: string,
	{ vsCurrency = 'usd', days = 1, interval, precision }: FetchCoinGeckoCoinMarketChartByIdOptions = {}
): Promise<CgMarketChartResponse | null> {
	if (!geckoId) return null

	const url = createCoinGeckoUrl(`/coins/${encodeURIComponent(geckoId)}/market_chart`)
	setQueryParam(url, 'vs_currency', vsCurrency)
	setQueryParam(url, 'days', days)
	setQueryParam(url, 'interval', interval)
	setQueryParam(url, 'precision', precision)

	return fetchCoinGeckoJson<CgMarketChartResponse>(url.pathname, url).catch(() => null)
}

async function fetchCoinGeckoCoinMarketChartByIdForRange({
	geckoId,
	vsCurrency = 'usd',
	from,
	to
}: {
	geckoId: string
	vsCurrency?: string
	from: number
	to: number
}): Promise<CgMarketChartResponse | null> {
	const url = createCoinGeckoUrl(`/coins/${encodeURIComponent(geckoId)}/market_chart/range`)
	setQueryParam(url, 'vs_currency', vsCurrency)
	setQueryParam(url, 'from', from)
	setQueryParam(url, 'to', to)

	return fetchCoinGeckoJson<CgMarketChartResponse>(url.pathname, url).catch(() => null)
}

interface LlamaCoinsChartResponse {
	coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }>
}

type LlamaChartPeriod = '5m' | '1h' | '6h' | '12h' | '1d' | '1w' | '2w'

interface LlamaChartRequest {
	period: LlamaChartPeriod
	span: number
}

type CoinGeckoChartRange =
	| {
			request: { kind: 'days'; days: number | 'max' }
			llama: LlamaChartRequest & { fromTimestampMs?: never }
	  }
	| {
			request: { kind: 'range'; fromTimestamp: number; toTimestamp: number }
			llama: LlamaChartRequest & { fromTimestampMs: number }
	  }

const COINGECKO_CHART_RANGES = {
	'24H': { request: { kind: 'days', days: 1 }, llama: { period: '5m', span: 288 } },
	'7D': { request: { kind: 'days', days: 7 }, llama: { period: '1h', span: 168 } },
	'1M': { request: { kind: 'days', days: 30 }, llama: { period: '6h', span: 120 } },
	'3M': { request: { kind: 'days', days: 90 }, llama: { period: '12h', span: 180 } },
	'1Y': { request: { kind: 'days', days: 365 }, llama: { period: '1d', span: 365 } },
	'5Y': { request: { kind: 'days', days: 1825 }, llama: { period: '1w', span: 261 } },
	MAX: { request: { kind: 'days', days: 'max' }, llama: { period: '2w', span: 500 } }
} satisfies Record<Exclude<PriceChartTimeframe, 'YTD'>, CoinGeckoChartRange>

const DAY_IN_MS = 24 * 60 * 60 * 1000

function getCoinGeckoChartRange(timeframe: PriceChartTimeframe, now: number): CoinGeckoChartRange {
	if (timeframe !== 'YTD') return COINGECKO_CHART_RANGES[timeframe]

	const date = new Date(now)
	const fromTimestampMs = Date.UTC(date.getUTCFullYear(), 0, 1)
	return {
		request: {
			kind: 'range',
			fromTimestamp: fromTimestampMs / 1e3,
			toTimestamp: Math.floor(now / 1e3)
		},
		llama: {
			period: '1d',
			span: Math.ceil((now - fromTimestampMs) / DAY_IN_MS) + 1,
			fromTimestampMs
		}
	}
}

async function fetchLlamaPricesFallback({
	geckoId,
	range
}: {
	geckoId: string
	range: CoinGeckoChartRange['llama']
}): Promise<Array<[number, number]> | null> {
	const url = `${COINS_CHART_API}/coingecko:${encodeURIComponent(geckoId)}?period=${range.period}&span=${range.span}`
	const response = await fetchJson<LlamaCoinsChartResponse>(url).catch(() => null)
	const series = response?.coins?.[`coingecko:${geckoId}`]?.prices
	if (!series?.length) return null

	const prices: Array<[number, number]> = []
	for (const point of series) {
		const timestampMs = point.timestamp * 1000
		if (range.fromTimestampMs !== undefined && timestampMs < range.fromTimestampMs) continue
		prices.push([timestampMs, point.price])
	}
	return prices.length > 0 ? prices : null
}

async function fetchCgChartFresh({
	geckoId,
	range
}: {
	geckoId: string
	range: CoinGeckoChartRange
}): Promise<CgChartResponse['data'] | null> {
	const marketChart =
		range.request.kind === 'days'
			? await fetchCoinGeckoCoinMarketChartById(geckoId, {
					vsCurrency: 'usd',
					days: range.request.days
				})
			: await fetchCoinGeckoCoinMarketChartByIdForRange({
					geckoId,
					from: range.request.fromTimestamp,
					to: range.request.toTimestamp
				})

	let prices: Array<[number, number]> | undefined = marketChart?.prices
	if (!prices?.length) {
		const llamaPrices = await fetchLlamaPricesFallback({ geckoId, range: range.llama })
		if (llamaPrices) prices = llamaPrices
	}

	if (!prices?.length) return null

	return {
		prices,
		...(marketChart?.market_caps !== undefined ? { mcaps: marketChart.market_caps } : {}),
		...(marketChart?.total_volumes !== undefined ? { volumes: marketChart.total_volumes } : {})
	}
}

function removeNegativeMarketCaps(data: NonNullable<CgChartResponse['data']>): NonNullable<CgChartResponse['data']> {
	const mcaps = data.mcaps
	if (!mcaps) return data

	let firstNegativeIndex = -1
	for (let i = 0; i < mcaps.length; i++) {
		if (mcaps[i]![1] < 0) {
			firstNegativeIndex = i
			break
		}
	}
	if (firstNegativeIndex === -1) return data

	const validMcaps = mcaps.slice(0, firstNegativeIndex)
	for (let i = firstNegativeIndex + 1; i < mcaps.length; i++) {
		const point = mcaps[i]!
		if (point[1] >= 0) validMcaps.push(point)
	}
	return { ...data, mcaps: validMcaps }
}

async function getCachedCgChartData(
	geckoId: string,
	timeframe: PriceChartTimeframe
): Promise<CgChartResponse['data'] | null> {
	if (!geckoId) return null
	const now = Date.now()
	const cacheTimeframe = timeframe === 'YTD' ? `${timeframe}_${new Date(now).getUTCFullYear()}` : timeframe
	const cacheKey = `cgchart_${geckoId}_timeframe_${cacheTimeframe}`
	const cached = await getObjectCache<CgChartResponse['data']>(cacheKey)
	if (cached?.prices?.length) return removeNegativeMarketCaps(cached)

	const rawFresh = await fetchCgChartFresh({
		geckoId,
		range: getCoinGeckoChartRange(timeframe, now)
	})
	const fresh = rawFresh ? removeNegativeMarketCaps(rawFresh) : null
	if (fresh?.prices?.length) {
		await setObjectCache(cacheKey, fresh, CG_CHART_CACHE_TTL_SECONDS)
	}
	return fresh
}

type CgCoinData = NonNullable<NonNullable<CgChartResponse['data']>['coinData']>
const CG_CHART_COIN_DATA_OPTIONS = {
	localization: false,
	tickers: true,
	marketData: true,
	communityData: false,
	developerData: false,
	sparkline: false,
	includeCategoriesDetails: false
} as const

async function getCachedCgCoinData(geckoId: string): Promise<CgCoinData | null> {
	const cacheKey = `cgchart_${geckoId}_coin_data`
	const cached = await getObjectCache<CgCoinData>(cacheKey)
	if (cached) return cached

	const fresh = await fetchCoinGeckoCoinById(geckoId, CG_CHART_COIN_DATA_OPTIONS)
	if (fresh) await setObjectCache(cacheKey, fresh, CG_CHART_CACHE_TTL_SECONDS)
	return fresh
}

export async function fetchCoinGeckoChartByIdWithCacheFallback(
	geckoId: string,
	{
		timeframe,
		includeCoinData = false
	}: {
		timeframe: PriceChartTimeframe
		includeCoinData?: boolean
	}
): Promise<CgChartResponse | null> {
	if (!geckoId) return null

	if (typeof window === 'undefined') {
		const [data, coinData] = await Promise.all([
			getCachedCgChartData(geckoId, timeframe),
			includeCoinData ? getCachedCgCoinData(geckoId) : Promise.resolve(null)
		])
		return data ? { data: coinData ? { ...data, coinData } : data } : null
	}

	const url = new URL(`${CG_CHART_LOCAL_API_PATH}/${encodeURIComponent(geckoId)}`, window.location.origin)
	url.searchParams.set('timeframe', timeframe)
	if (includeCoinData) url.searchParams.set('includeCoinData', 'true')
	const chart = await fetchJson<CgChartResponse | null>(url.toString()).catch(() => null)
	return chart?.data?.prices?.length ? chart : null
}

/**
 * Fetch price, market cap, and volume history for a CoinGecko id to use as a denomination overlay.
 * This uses the same cache-first chart path as `fetchCoinGeckoChartByIdWithCacheFallback`.
 */
export async function fetchDenominationPriceHistoryByCoinGeckoId(geckoId: string): Promise<DenominationPriceHistory> {
	const chart = await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, { timeframe: 'MAX' })
	const data = chart?.data

	const prices = Array.isArray(data?.prices) ? data.prices : []
	const mcaps = Array.isArray(data?.mcaps) ? data.mcaps : []
	const volumes = Array.isArray(data?.volumes) ? data.volumes : []

	return prices.length > 0 ? { prices, mcaps, volumes } : { prices: [], mcaps: [], volumes: [] }
}
