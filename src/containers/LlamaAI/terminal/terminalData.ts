import { AI_SERVER } from '~/constants'
import { CHART_COLORS } from '~/constants/colors'
import { subscribeTerminalBars, type TerminalBar, unsubscribeTerminalListener } from './terminalSocket'
import type { TerminalWidget } from './terminalViewStore'

const TERMINAL_API = `${AI_SERVER}/terminal`
const UDF_BUNDLE_SRC = '/assets/datafeeds/bundle.js'
const CACHE_TTL_MS = 600_000

export const FUNDAMENTAL_PREFIX = 'DEFILLAMA:'
export const AGENT_PREFIX = 'LLAMAAI:'
// Saved layouts embed a copy of this metainfo and are re-matched by id, so changing it strands
// every layout that already exists on a frozen old definition.
const STUDY_ID = 'DefiLlama@tv-basicstudies-1'
const TRADES_STUDY_ID = 'DefiLlamaTrades@tv-basicstudies-1'
export const STUDY_NAME = 'DefiLlama'
export const TRADES_STUDY_NAME = 'DefiLlama Trades'
export const SOURCE_INPUT_ID = 'source'

export type TerminalEntityKind = 'protocol' | 'chain'

export interface TerminalEntities {
	protocols: Array<string>
	chains: Array<string>
}

export interface TerminalSymbolInfo {
	name: string
	ticker?: string
	[key: string]: unknown
}

interface TerminalPeriodParams {
	from: number
	to: number
	countBack: number
	firstDataRequest: boolean
}

export interface TerminalDatafeed {
	onReady(callback: (configuration: Record<string, unknown>) => void): void
	searchSymbols(
		input: string,
		exchange: string,
		symbolType: string,
		onResult: (items: Array<unknown>) => void,
		searchSource?: string
	): void
	resolveSymbol(
		symbolName: string,
		onResolve: (info: TerminalSymbolInfo) => void,
		onError: (reason: string) => void,
		extension?: unknown
	): void
	getBars(
		symbolInfo: TerminalSymbolInfo,
		resolution: string,
		periodParams: TerminalPeriodParams,
		onResult: (bars: Array<Partial<TerminalBar>>, meta: { noData: boolean }) => void,
		onError: (reason: string) => void
	): void
	subscribeBars(
		symbolInfo: TerminalSymbolInfo,
		resolution: string,
		onTick: (bar: TerminalBar) => void,
		listenerGuid: string
	): void
	unsubscribeBars(listenerGuid: string): void
	getTimescaleMarks(
		symbolInfo: TerminalSymbolInfo,
		from: number,
		to: number,
		onResult: (marks: Array<TerminalTimescaleMark>) => void,
		resolution: string
	): void
}

export interface TerminalTimescaleMark {
	id: string | number
	time: number
	color: string
	label: string
	tooltip: Array<string>
	labelFontColor?: string
}

type TerminalDatafeedBase = new (
	datafeedURL: string,
	quotesProvider: unknown,
	requester: unknown,
	updateFrequency?: number
) => TerminalDatafeed

declare global {
	interface Window {
		Datafeeds?: { UDFCompatibleDatafeed: new (datafeedURL: string) => TerminalDatafeed }
	}
}

const scriptPromises = new Map<string, Promise<void>>()

export function loadTerminalScript(src: string): Promise<void> {
	const cached = scriptPromises.get(src)
	if (cached) return cached
	const promise = new Promise<void>((resolve, reject) => {
		const script = document.createElement('script')
		script.src = src
		script.addEventListener('load', () => resolve())
		script.addEventListener('error', () => {
			scriptPromises.delete(src)
			reject(new Error(`Failed to load ${src}`))
		})
		document.head.appendChild(script)
	})
	scriptPromises.set(src, promise)
	return promise
}

const withTtl = <T>(store: Map<string, { at: number; value: Promise<T> }>, key: string, load: () => Promise<T>) => {
	const hit = store.get(key)
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
	const value = load()
	store.set(key, { at: Date.now(), value })
	value.catch(() => store.delete(key))
	return value
}

const entityCache = new Map<string, { at: number; value: Promise<TerminalEntities> }>()

const EMPTY_ENTITIES: TerminalEntities = { protocols: [], chains: [] }

/**
 * The raw symbol, never uppercased: the k-wrapper rule needs kPEPE to stay distinct from KAITO.
 * `fetchFn` is passed rather than held in module scope because the panel resolves a symbol before
 * the datafeed finishes building, and an unauthorized miss must not be what gets cached.
 */
export function fetchTerminalEntities(symbol: string, fetchFn: typeof fetch): Promise<TerminalEntities> {
	if (!symbol) return Promise.resolve(EMPTY_ENTITIES)
	return withTtl(entityCache, symbol, async () => {
		const res = await fetchFn(`${TERMINAL_API}/entities?symbol=${encodeURIComponent(symbol)}`)
		if (!res.ok) throw new Error(`Terminal entities ${res.status}`)
		const data = await res.json()
		return {
			protocols: Array.isArray(data?.protocols) ? data.protocols : [],
			chains: Array.isArray(data?.chains) ? data.chains : []
		}
	})
}

export function fundamentalTicker(kind: TerminalEntityKind, slug: string, metric: string): string {
	return `${FUNDAMENTAL_PREFIX}${kind}/${slug}/${metric}`
}

/** The entity a symbol should default to: a protocol is more specific than the chain it runs on. */
export function defaultEntityFor(entities: TerminalEntities): { kind: TerminalEntityKind; slug: string } | null {
	if (entities.protocols.length > 0) return { kind: 'protocol', slug: entities.protocols[0] }
	if (entities.chains.length > 0) return { kind: 'chain', slug: entities.chains[0] }
	return null
}

// The prompt path needs the entity synchronously; the panel keeps this in step with the chart.
let currentEntity: { kind: TerminalEntityKind; slug: string } | null = null

export function setCurrentTerminalEntity(next: { kind: TerminalEntityKind; slug: string } | null) {
	currentEntity = next
}

export function getCurrentTerminalEntity() {
	return currentEntity
}

export function defaultSourceFor(entities: TerminalEntities): string | null {
	const entity = defaultEntityFor(entities)
	return entity ? fundamentalTicker(entity.kind, entity.slug, 'tvl') : null
}

/**
 * A stock reads against price and belongs on it as a line. A flow — fees, revenue — is a bar per
 * day in its own pane, and sharing the price scale would flatten it to nothing.
 */
export function belongsOnPricePane(ticker: string): boolean {
	return ticker.endsWith('/tvl')
}

// The plot's style key is its declared title, and the value is the style's NAME: the numeric
// LineStudyPlotStyle is accepted only on the raw `styles.<plotId>.plottype` path.
export const PLOT_TITLE = 'Value'

export function plotOverridesFor(ticker: string): Record<string, string | number> {
	return belongsOnPricePane(ticker)
		? { [`${PLOT_TITLE}.plottype`]: 'line', [`${PLOT_TITLE}.linewidth`]: 2, [`${PLOT_TITLE}.color`]: CHART_COLORS[2] }
		: {
				[`${PLOT_TITLE}.plottype`]: 'columns',
				[`${PLOT_TITLE}.linewidth`]: 1,
				[`${PLOT_TITLE}.color`]: CHART_COLORS[0]
			}
}

export interface AgentSeriesPoint {
	time: number
	value: number
}

export interface AgentBar {
	time: number
	open: number
	high: number
	low: number
	close: number
}

interface AgentSeries {
	name: string
	bars: Array<AgentBar>
}

const agentSeries = new Map<string, AgentSeries>()
let agentSeriesSeq = 0

export function isAgentTicker(ticker: string | null | undefined): boolean {
	return typeof ticker === 'string' && ticker.startsWith(AGENT_PREFIX)
}

/**
 * The points travel inside the op and live only here: the ticker is the address the study binds to.
 * A fresh suffix per registration is what stops the library serving the previous series' cached
 * bars for a reused op id; keying eviction on the op id keeps the map bounded by live drawings.
 */
export function registerAgentBars(opId: string, name: string, bars: Array<AgentBar>): string {
	const owner = `${AGENT_PREFIX}${opId}.`
	for (const key of agentSeries.keys()) {
		if (key.startsWith(owner)) agentSeries.delete(key)
	}
	const ticker = `${owner}${++agentSeriesSeq}`
	agentSeries.set(ticker, { name, bars })
	return ticker
}

export function registerAgentSeries(opId: string, name: string, points: Array<AgentSeriesPoint>): string {
	return registerAgentBars(
		opId,
		name,
		points.map((point) => ({
			time: point.time,
			open: point.value,
			high: point.value,
			low: point.value,
			close: point.value
		}))
	)
}

export const TRADE_FILL_KINDS = ['long_entry', 'long_exit', 'short_entry', 'short_exit'] as const

export type TradeFillKind = (typeof TRADE_FILL_KINDS)[number]

export interface TradeFill {
	time: number
	price: number
	kind: TradeFillKind
}

const FILL_FIELD: Record<TradeFillKind, 'open' | 'high' | 'low' | 'close'> = {
	long_entry: 'open',
	long_exit: 'high',
	short_entry: 'low',
	short_exit: 'close'
}

const NO_FILL = 0

/**
 * The four marker families ride in the four OHLC fields of one ticker, because a family with no
 * fills at all would otherwise be a symbol with no bars and the study would not compute. Two fills
 * of the same family on one bar collapse to the later one.
 */
export function tradeBars(fills: Array<TradeFill>): Array<AgentBar> {
	const bars = new Map<number, AgentBar>()
	for (const fill of fills) {
		const bar = bars.get(fill.time) ?? {
			time: fill.time,
			open: NO_FILL,
			high: NO_FILL,
			low: NO_FILL,
			close: NO_FILL
		}
		bar[FILL_FIELD[fill.kind]] = fill.price
		bars.set(fill.time, bar)
	}
	return [...bars.values()].sort((a, b) => a.time - b.time)
}

/**
 * countBack outranks `from` in the datafeed contract, and the library pads `from` far past the
 * series when the main symbol carries more history than the agent's data. Bar times are
 * milliseconds here; the op carries unix seconds.
 */
export function agentSeriesBars(
	ticker: string,
	periodParams: Pick<TerminalPeriodParams, 'to' | 'countBack'>
): Array<Partial<TerminalBar>> | null {
	const series = agentSeries.get(ticker)
	if (!series) return null
	// Everything up to `to`, never a countBack slice. countBack counts bars at the resolution the
	// library asked for, and these bars are at whatever resolution the agent computed at — a daily
	// request against an hourly series cut 600 of 900 points off the front, head first and silently.
	// countBack is a minimum the feed must meet, so answering with more is within the contract.
	const window = series.bars.filter((bar) => bar.time <= periodParams.to)
	return window.map((bar) => ({
		time: bar.time * 1000,
		open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,
		volume: 0
	}))
}

/**
 * The bars are served from memory whatever resolution is asked for, so the ticker carries no list
 * of its own: an absent `supported_resolutions` means every resolution the feed configuration
 * advertises. Without has_intraday the library folds a whole day of fills into one bar.
 */
export function agentSymbolInfo(ticker: string, name: string): TerminalSymbolInfo {
	return {
		name,
		ticker,
		full_name: ticker,
		description: name,
		type: 'defillama',
		session: '24x7',
		exchange: 'LlamaAI',
		listed_exchange: 'LlamaAI',
		timezone: 'Etc/UTC',
		format: 'price',
		minmov: 1,
		pricescale: 100,
		has_intraday: true,
		has_daily: true,
		has_weekly_and_monthly: true,
		volume_precision: 0,
		data_status: 'endofday'
	}
}

export interface TerminalLayers {
	unlocks: boolean
	events: boolean
	drawings: boolean
	trades: boolean
}

export const DEFAULT_TERMINAL_LAYERS: TerminalLayers = { unlocks: true, events: true, drawings: true, trades: true }

const USER_SETTINGS_URL = `${AI_SERVER}/user-settings`

let layers: TerminalLayers = DEFAULT_TERMINAL_LAYERS
let layersLoad: Promise<TerminalLayers> | null = null

export const getTerminalLayers = () => layers

export function layersOf(value: unknown): TerminalLayers {
	const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
	return {
		unlocks: stored.unlocks !== false,
		events: stored.events !== false,
		drawings: stored.drawings !== false,
		trades: stored.trades !== false
	}
}

// Per user, in ops.user_settings: a layer the user hid stays hidden on every device.
export function loadTerminalLayers(fetchFn: typeof fetch): Promise<TerminalLayers> {
	return layersLoad ?? reloadTerminalLayers(fetchFn)
}

export function reloadTerminalLayers(fetchFn: typeof fetch): Promise<TerminalLayers> {
	layers = DEFAULT_TERMINAL_LAYERS
	const load: Promise<TerminalLayers> = fetchFn(USER_SETTINGS_URL)
		.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`User settings ${res.status}`))))
		.then((data) => {
			if (layersLoad === load) layers = layersOf(data?.settings?.terminalLayers)
			return layers
		})
		.catch(() => layers)
	layersLoad = load
	return load
}

export function saveTerminalLayers(next: TerminalLayers, fetchFn: typeof fetch) {
	layers = next
	layersLoad = Promise.resolve(next)
	fetchFn(USER_SETTINGS_URL, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ settings: { terminalLayers: next } })
	})
		.then((res) => {
			if (!res.ok) throw new Error(`User settings ${res.status}`)
		})
		.catch(() =>
			// Loaded on failure only: the toast library touches `document` as it is imported.
			import('react-hot-toast').then(({ default: toast }) =>
				toast.error('Could not save the chart layers. They reset on the next load.')
			)
		)
}

export interface AgentMark {
	time: number
	number: number
	title: string
	reason?: string
	color?: string
}

// The agent's events and marks sets, as the datafeed serves them next to the server's unlocks.
let agentMarks: { symbol: string | null; marks: Array<AgentMark> } = { symbol: null, marks: [] }

export function setAgentMarks(symbol: string | null, marks: Array<AgentMark>) {
	agentMarks = { symbol, marks }
}

function markDate(time: number): string {
	const iso = new Date(time * 1000).toISOString()
	return time % 86_400 === 0 ? iso.slice(0, 10) : `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

// The library takes a colour string, not a var(), and the brand token is what sets an agent badge
// apart from the orange unlock badge.
function brandColor(): string {
	if (typeof document === 'undefined') return ''
	return getComputedStyle(document.documentElement).getPropertyValue('--bg-brand').trim()
}

export function agentTimescaleMarks(ticker: string, from: number, to: number): Array<TerminalTimescaleMark> {
	if (agentMarks.symbol !== ticker) return []
	const brand = brandColor()
	return agentMarks.marks
		.map((mark, index) => ({
			id: `agent_${index}`,
			time: mark.time,
			color: mark.color ?? brand,
			label: String(mark.number),
			tooltip: [`#${mark.number} · ${mark.title}`, ...(mark.reason ? [mark.reason] : []), markDate(mark.time)]
		}))
		.filter((mark) => mark.time >= from && mark.time <= to)
}

const createRequester = (fetchFn: typeof fetch) => ({
	sendRequest: async (datafeedUrl: string, urlPath: string, params?: Record<string, string | number>) => {
		const query = params
			? new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()
			: ''
		const response = await fetchFn(`${datafeedUrl}/${urlPath}${query ? `?${query}` : ''}`)
		if (!response.ok) throw new Error(`Terminal ${urlPath} ${response.status}`)
		return response.json()
	}
})

const quotesProviderStub = { getQuotes: () => Promise.resolve([]) }

export async function createTerminalDatafeed(options: { fetchFn: typeof fetch }): Promise<TerminalDatafeed> {
	await loadTerminalScript(UDF_BUNDLE_SRC)
	const udfDatafeed = window.Datafeeds?.UDFCompatibleDatafeed
	if (!udfDatafeed) throw new Error('UDF datafeed bundle is not available')

	// The bundle only exports the leaf class, whose constructor pins its own unauthenticated
	// requester. The base class it extends is the one that accepts an IRequester.
	const DatafeedBase = Object.getPrototypeOf(udfDatafeed) as TerminalDatafeedBase

	void reloadTerminalLayers(options.fetchFn)

	class LlamaTerminalDatafeed extends DatafeedBase {
		override onReady(callback: (configuration: Record<string, unknown>) => void) {
			super.onReady((configuration) => callback({ ...configuration, supports_timescale_marks: true }))
		}

		// The bundled adapter drops the searchSource argument and uppercases the query, which
		// mangles the lowercase slugs the DefiLlama namespace is keyed on.
		override searchSymbols(
			input: string,
			exchange: string,
			symbolType: string,
			onResult: (items: Array<unknown>) => void,
			searchSource?: string
		) {
			const params = new URLSearchParams({ query: input, limit: '30' })
			if (exchange) params.set('exchange', exchange)
			if (symbolType) params.set('type', symbolType)
			// Searching from an indicator's symbol input means DefiLlama series, never perps.
			if (searchSource) params.set('source', searchSource)
			options
				.fetchFn(`${TERMINAL_API}/search?${params.toString()}`)
				.then((res) => (res.ok ? res.json() : []))
				.then((items) => onResult(Array.isArray(items) ? items : []))
				.catch(() => onResult([]))
		}

		// An agent series never leaves the browser: its points arrived in the ops payload, so the
		// interception has to come before anything that would put this ticker on the wire.
		override resolveSymbol(
			symbolName: string,
			onResolve: (info: TerminalSymbolInfo) => void,
			onError: (reason: string) => void,
			extension?: unknown
		) {
			if (!isAgentTicker(symbolName)) return super.resolveSymbol(symbolName, onResolve, onError, extension)
			// A saved layout can restore a study before the chat replays the op that carries its
			// points. An empty pane is the answer; the ticker has no server side to ask.
			onResolve(agentSymbolInfo(symbolName, agentSeries.get(symbolName)?.name ?? STUDY_NAME))
		}

		override getBars(
			symbolInfo: TerminalSymbolInfo,
			resolution: string,
			periodParams: TerminalPeriodParams,
			onResult: (bars: Array<Partial<TerminalBar>>, meta: { noData: boolean }) => void,
			onError: (reason: string) => void
		) {
			const ticker = symbolInfo.ticker ?? symbolInfo.name
			if (!isAgentTicker(ticker)) return super.getBars(symbolInfo, resolution, periodParams, onResult, onError)
			const bars = agentSeriesBars(ticker, periodParams) ?? []
			onResult(bars, { noData: bars.length === 0 })
		}

		override subscribeBars(
			symbolInfo: TerminalSymbolInfo,
			resolution: string,
			onTick: (bar: TerminalBar) => void,
			listenerGuid: string
		) {
			const ticker = symbolInfo.ticker ?? symbolInfo.name
			// A daily fundamental series and a finished agent series both have nothing to stream.
			if (ticker.startsWith(FUNDAMENTAL_PREFIX) || isAgentTicker(ticker)) return
			subscribeTerminalBars(listenerGuid, ticker, resolution, onTick)
		}

		override unsubscribeBars(listenerGuid: string) {
			unsubscribeTerminalListener(listenerGuid)
		}

		// Held until the user's layers load, so a layer they hid never flashes on the first paint.
		override getTimescaleMarks(
			symbolInfo: TerminalSymbolInfo,
			from: number,
			to: number,
			onResult: (marks: Array<TerminalTimescaleMark>) => void,
			resolution: string
		) {
			const ticker = symbolInfo.ticker ?? symbolInfo.name
			void loadTerminalLayers(options.fetchFn).then(({ unlocks }) => {
				const own = () => (getTerminalLayers().events ? agentTimescaleMarks(ticker, from, to) : [])
				if (!unlocks) return onResult(own())
				super.getTimescaleMarks(symbolInfo, from, to, (server) => onResult([...server, ...own()]), resolution)
			})
		}
	}

	return new LlamaTerminalDatafeed(TERMINAL_API, quotesProviderStub, createRequester(options.fetchFn))
}

interface StudyMetainfo {
	description?: string
	shortDescription?: string
	is_price_study?: boolean
	is_hidden_study?: boolean
	inputs?: Array<Record<string, unknown>>
}

const CATALOGUE_INPUT_KEYS = ['id', 'name', 'type', 'defval', 'min', 'max', 'options'] as const

/**
 * What `createStudy` will accept on this build, as the agent is allowed to see it. An input marked
 * isHidden is machine-populated from the viewport, so it never leaves the browser; `isHidden` is
 * sparse, and an absent key means visible.
 */
export function studyCatalogueFrom(metainfos: Array<StudyMetainfo>) {
	return metainfos
		.filter(
			(info) =>
				!info.is_hidden_study &&
				typeof info.description === 'string' &&
				info.description &&
				// Our own studies are in this table too. Offering one as an indicator the agent can
				// name gets it added with an empty source, which plots nothing, cannot be filled in
				// after the fact, and saves into the layout because it carries no LLAMAAI: ticker to
				// strip. The agent reaches these through the ops that bind them to a ticker.
				info.description !== STUDY_NAME &&
				info.description !== TRADES_STUDY_NAME
		)
		.map((info) => ({
			name: info.description as string,
			shortDescription: info.shortDescription ?? '',
			is_price_study: info.is_price_study === true,
			inputs: (info.inputs ?? [])
				.filter((input) => input.isHidden !== true)
				.map((input) =>
					Object.fromEntries(
						CATALOGUE_INPUT_KEYS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])
					)
				)
		}))
}

let postedVersion: string | null = null

// is_price_study and shortDescription — the acronym vocabulary the agent names studies by — exist
// only on the raw metainfo, not on the public getStudiesList().
const CATALOGUE_RETRY_MS = 400
const CATALOGUE_TRIES = 15

/**
 * The widget the page holds and the `tradingViewApi` the library publishes inside its own frame are
 * not the same object, and only the frame's carries the study table. `shortDescription` — the
 * acronym vocabulary the agent names indicators by — exists nowhere else, so falling back to the
 * public getStudiesList() would resolve "RSI" to Connors RSI.
 */
function studyMetainfos(widget: TerminalWidget): unknown {
	const own = widget._chartApiInstance?.allStudiesMetadata?.()
	if (Array.isArray(own) && own.length > 0) return own
	for (const frame of Array.from(document.querySelectorAll('iframe'))) {
		try {
			const api = (frame.contentWindow as unknown as { tradingViewApi?: TerminalWidget } | null)?.tradingViewApi
			const rows = api?._chartApiInstance?.allStudiesMetadata?.()
			if (Array.isArray(rows) && rows.length > 0) return rows
		} catch {
			// A frame from another origin is not ours to read.
		}
	}
	return null
}

export function postStudyCatalogue(widget: TerminalWidget, fetchFn: typeof fetch, tries = CATALOGUE_TRIES) {
	const version = window.TradingView?.version?.() ?? 'unknown'
	if (postedVersion === version) return
	const metainfos = studyMetainfos(widget)
	// The study table is populated a little after the chart reports ready, and this is the only
	// moment it is offered. Giving up here leaves the agent unable to name any indicator for the
	// life of the page, so wait for it rather than miss it.
	if (!Array.isArray(metainfos) || metainfos.length === 0) {
		if (tries > 0) setTimeout(() => postStudyCatalogue(widget, fetchFn, tries - 1), CATALOGUE_RETRY_MS)
		return
	}
	postedVersion = version
	fetchFn(`${TERMINAL_API}/studies`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ version, studies: studyCatalogueFrom(metainfos as Array<StudyMetainfo>) })
	})
		// A rejected POST resolves, it does not throw, so only checking for a thrown error marks a
		// refused catalogue as delivered and never retries it.
		.then((res) => {
			if (!res.ok) postedVersion = null
		})
		.catch(() => {
			postedVersion = null
		})
}

interface StudySeries {
	adopt: (source: StudySeries, destination: StudySeries, mode: 0 | 1) => number
}

interface StudyContext {
	symbol: { time: number; period: string; isLastBar?: boolean }
	new_sym: (ticker: string, period: string) => void
	select_sym: (index: number) => void
	new_unlimited_var: (value?: number) => StudySeries
}

type StudyInputReader = (index: number) => string | number | boolean

interface StudyInstance {
	_bound?: boolean
	init: (context: StudyContext, inputs: StudyInputReader) => void
	main: (context: StudyContext, inputs: StudyInputReader) => Array<number>
}

/** A symbol input arrives as `=` followed by JSON, not as a bare ticker. */
export function readSymbolInput(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length === 0) return null
	if (!raw.startsWith('=')) return raw
	try {
		const parsed = JSON.parse(raw.slice(1))
		return typeof parsed?.symbol === 'string' && parsed.symbol ? parsed.symbol : null
	} catch {
		return null
	}
}

export interface TerminalPineJs {
	Std: Record<'open' | 'high' | 'low' | 'close', (context: unknown) => number>
}

/**
 * The period a study binds its ticker at. A series carries one point a day, so it asks for the daily
 * grid whatever the chart shows. Trades follow the chart: on a fixed daily period every fill inside
 * one UTC day is folded into one bar, and only the last one written survives.
 */
export function studyBindPeriod(study: 'series' | 'trades', chartPeriod: string): string {
	return study === 'trades' ? chartPeriod : '1D'
}

const studyConstructor = (PineJS: TerminalPineJs) =>
	function DefiLlamaStudy(this: StudyInstance) {
		this.init = (context, inputs) => {
			const ticker = readSymbolInput(inputs(0))
			this._bound = !!ticker
			if (ticker) context.new_sym(ticker, studyBindPeriod('series', context.symbol.period))
		}
		this.main = (context) => {
			if (!this._bound) return [NaN]
			const mainTimes = context.new_unlimited_var(context.symbol.time)
			context.select_sym(1)
			const seriesTimes = context.new_unlimited_var(context.symbol.time)
			const value = context.new_unlimited_var(PineJS.Std.close(context))
			context.select_sym(0)
			// Continuous mode carries a daily value across every intraday bar; precise mode would
			// leave NaN between them and the renderer would bridge the gaps with invented values.
			return [value.adopt(seriesTimes, mainTimes, 0)]
		}
	}

// A marker is a glyph of 25px scaled by this, so `tiny` is 7.5px: about the width of a daily
// candle. `small` is 15px, which covers the candle it is marking.
const MARKER_SIZE = 'tiny'

const BUY = { plottype: 'shape_triangle_up', location: 'BelowBar', color: '#089981' }
const SELL = { plottype: 'shape_triangle_down', location: 'AboveBar', color: '#cc2f3c' }

// The pairs render identically; they stay four plots so the legend can name which side filled.
const TRADE_PLOTS: Array<{ kind: TradeFillKind; title: string } & typeof BUY> = [
	{ kind: 'long_entry', title: 'Long entry', ...BUY },
	{ kind: 'long_exit', title: 'Long exit', ...SELL },
	{ kind: 'short_entry', title: 'Short entry', ...SELL },
	{ kind: 'short_exit', title: 'Short exit', ...BUY }
]

const tradePlotId = (index: number) => `plot_${index}`

const OHLC_FIELDS = ['open', 'high', 'low', 'close'] as const

/**
 * One value per trade plot for a chart bar: the fill price read from that kind's OHLC field, or
 * NaN where no fill of that kind landed. A study with no bound ticker passes null and plots nothing.
 */
export function tradeMarkers(bar: Pick<AgentBar, (typeof OHLC_FIELDS)[number]> | null): Array<number> {
	return TRADE_PLOTS.map((plot) => {
		const price = bar ? bar[FILL_FIELD[plot.kind]] : NO_FILL
		return price > NO_FILL ? price : NaN
	})
}

const tradesConstructor = (PineJS: TerminalPineJs) =>
	function DefiLlamaTradesStudy(this: StudyInstance) {
		this.init = (context, inputs) => {
			const ticker = readSymbolInput(inputs(0))
			this._bound = !!ticker
			if (ticker) context.new_sym(ticker, studyBindPeriod('trades', context.symbol.period))
		}
		this.main = (context) => {
			if (!this._bound) return tradeMarkers(null)
			const mainTimes = context.new_unlimited_var(context.symbol.time)
			context.select_sym(1)
			const fillTimes = context.new_unlimited_var(context.symbol.time)
			const fields = OHLC_FIELDS.map((field) => context.new_unlimited_var(PineJS.Std[field](context)))
			context.select_sym(0)
			// Precise mode puts a fill on the bar it filled on and leaves every other bar empty;
			// continuous mode would repeat the last fill across the bars after it.
			const [open, high, low, close] = fields.map((field) => field.adopt(fillTimes, mainTimes, 1))
			return tradeMarkers({ open, high, low, close })
		}
	}

export function createTerminalStudies() {
	return (PineJS: TerminalPineJs) =>
		Promise.resolve([
			{
				name: STUDY_NAME,
				metainfo: {
					_metainfoVersion: 51,
					id: STUDY_ID,
					description: STUDY_NAME,
					shortDescription: STUDY_NAME,
					is_price_study: false,
					isCustomIndicator: true,
					format: { type: 'volume' },
					plots: [{ id: 'plot_0', type: 'line' }],
					defaults: {
						styles: {
							plot_0: {
								linestyle: 0,
								visible: true,
								linewidth: 2,
								plottype: 0,
								trackPrice: false,
								color: CHART_COLORS[2]
							}
						},
						inputs: { [SOURCE_INPUT_ID]: '' }
					},
					styles: { plot_0: { title: 'Value', histogramBase: 0 } },
					inputs: [
						{
							id: SOURCE_INPUT_ID,
							name: 'Source',
							type: 'symbol',
							defval: '',
							isAlwaysShownInLegend: true
						}
					]
				},
				constructor: studyConstructor(PineJS)
			},
			{
				name: TRADES_STUDY_NAME,
				metainfo: {
					_metainfoVersion: 51,
					id: TRADES_STUDY_ID,
					description: TRADES_STUDY_NAME,
					shortDescription: TRADES_STUDY_NAME,
					is_price_study: true,
					isCustomIndicator: true,
					format: { type: 'inherit' },
					plots: TRADE_PLOTS.map((_plot, index) => ({ id: tradePlotId(index), type: 'shapes' })),
					defaults: {
						styles: Object.fromEntries(
							TRADE_PLOTS.map((plot, index) => [
								tradePlotId(index),
								{
									plottype: plot.plottype,
									// Clear of the candle rather than on the wick. The plot's value stops
									// being read as a price here: anything but NaN means "marker on this bar".
									location: plot.location,
									visible: true,
									transparency: 0,
									color: plot.color
								}
							])
						),
						inputs: { [SOURCE_INPUT_ID]: '' }
					},
					// The shapes pane view reads this entry per plot and throws without one.
					styles: Object.fromEntries(
						TRADE_PLOTS.map((plot, index) => [tradePlotId(index), { title: plot.title, size: MARKER_SIZE }])
					),
					inputs: [
						{
							id: SOURCE_INPUT_ID,
							name: 'Source',
							type: 'symbol',
							defval: '',
							isAlwaysShownInLegend: true
						}
					]
				},
				constructor: tradesConstructor(PineJS)
			}
		])
}
