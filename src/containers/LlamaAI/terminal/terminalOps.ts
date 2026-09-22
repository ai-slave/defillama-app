import { scheduleTerminalChatSave } from './terminalChatState'
import {
	belongsOnPricePane,
	getTerminalLayers,
	PLOT_TITLE,
	readSymbolInput,
	registerAgentBars,
	registerAgentSeries,
	SOURCE_INPUT_ID,
	STUDY_NAME,
	TRADE_FILL_KINDS,
	tradeBars,
	setAgentMarks,
	TRADES_STUDY_NAME,
	type AgentMark,
	type AgentSeriesPoint,
	type TradeFill
} from './terminalData'
import { eventMark, normalizeEventOp, type TerminalEventOp } from './terminalEvents'
import { resetTerminalIndicatorRuns } from './terminalIndicators'
import {
	chartTicker,
	getTerminalSymbol,
	getTerminalWidget,
	listTerminalScriptRefs,
	registerTerminalScript,
	resetTerminalScripts,
	type TerminalChart,
	type TerminalScriptRef
} from './terminalViewStore'

export interface TerminalOpPoint {
	time: number
	price: number
}

export const SERIES_STYLES = { line: 'line', histogram: 'columns', area: 'area' } as const

export type TerminalSeriesStyle = keyof typeof SERIES_STYLES
export type TerminalSeriesPlacement = 'pane' | 'overlay'

export interface TerminalOpMark {
	time: number
	text?: string
	color?: string
}

export type TerminalDrawOp =
	| { type: 'hline'; id: string; number: number; price: number; text?: string }
	| { type: 'trendline'; id: string; number: number; points: [TerminalOpPoint, TerminalOpPoint]; text?: string }
	| { type: 'vline'; id: string; number: number; time: number; text?: string }
	| { type: 'label'; id: string; number: number; time: number; price: number; text: string }
	| {
			type: 'zone'
			id: string
			number: number
			from: number
			to: number
			low: number
			high: number
			text?: string
	  }
	| { type: 'marks'; id: string; number: number; text: string; marks: Array<TerminalOpMark> }
	| { type: 'trades'; id: string; number: number; text: string; fills: Array<TradeFill> }
	| {
			type: 'series'
			id: string
			number: number
			text: string
			style: TerminalSeriesStyle
			placement: TerminalSeriesPlacement
			points: Array<AgentSeriesPoint>
	  }
	| TerminalEventOp

export type TerminalStudyInputs = Record<string, string | number | boolean>

export type TerminalOp =
	| TerminalDrawOp
	// A study, not a drawing: it joins the chart's saved layout and the user removes it natively.
	| { type: 'indicator'; ticker: string; label: string }
	| { type: 'indicator'; study: string; label: string; inputs?: TerminalStudyInputs }
	| { type: 'clear'; ids: Array<string> }
	| { type: 'view'; resolution?: string; from?: number; to?: number }
	// A saved indicator: the drawings above came out of this script, and the client re-runs it
	// against the backend on every symbol and range change.
	| { type: 'script'; file: string; inputs: Array<string> }

export interface TerminalOpsPayload {
	symbol: string
	interval: string
	ops: Array<TerminalOp>
}

export interface TerminalChatState {
	symbol: string
	interval: string
	ops: Array<TerminalDrawOp>
	scripts: Array<TerminalScriptRef>
}

const SHAPE_BY_TYPE: Record<
	Exclude<TerminalDrawOp['type'], 'trendline' | 'series' | 'zone' | 'marks' | 'trades' | 'event'>,
	string
> = {
	hline: 'horizontal_line',
	vline: 'vertical_line',
	label: 'text'
}

const TIMESCALE_MARKS = 2

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function isPoint(value: unknown): value is TerminalOpPoint {
	return isRecord(value) && isNumber(value.time) && isNumber(value.price)
}

function isSeriesPoint(value: unknown): value is AgentSeriesPoint {
	return isRecord(value) && isNumber(value.time) && isNumber(value.value)
}

function markOf(value: unknown): TerminalOpMark | null {
	if (!isRecord(value) || !isNumber(value.time)) return null
	return {
		time: value.time,
		...(typeof value.text === 'string' && value.text && { text: value.text }),
		...(typeof value.color === 'string' && value.color && { color: value.color })
	}
}

function fillOf(value: unknown): TradeFill | null {
	if (!isRecord(value) || !isNumber(value.time) || !isNumber(value.price)) return null
	const kind = TRADE_FILL_KINDS.find((entry) => entry === value.kind)
	return kind ? { time: value.time, price: value.price, kind } : null
}

// Ids, never positions: MACD's first input is `symbol`, so an array would be off by one, and its
// own ids run in_0, in_1, in_3, in_2.
function studyInputsOf(value: unknown): TerminalStudyInputs {
	if (!isRecord(value)) return {}
	const inputs: TerminalStudyInputs = {}
	for (const [id, input] of Object.entries(value)) {
		if (typeof input === 'string' || typeof input === 'boolean' || isNumber(input)) inputs[id] = input
	}
	return inputs
}

function normalizeOp(value: unknown): TerminalOp | null {
	if (!isRecord(value)) return null
	if (value.type === 'clear') {
		return {
			type: 'clear',
			ids: Array.isArray(value.ids) ? value.ids.filter((id): id is string => typeof id === 'string') : []
		}
	}
	if (value.type === 'indicator') {
		const label = typeof value.label === 'string' ? value.label : ''
		if (typeof value.study === 'string' && value.study) {
			return { type: 'indicator', study: value.study, label, inputs: studyInputsOf(value.inputs) }
		}
		if (typeof value.ticker !== 'string' || !value.ticker) return null
		return { type: 'indicator', ticker: value.ticker, label }
	}
	if (value.type === 'script') {
		if (typeof value.file !== 'string' || !value.file) return null
		return {
			type: 'script',
			file: value.file,
			inputs: Array.isArray(value.inputs) ? value.inputs.filter((name): name is string => typeof name === 'string') : []
		}
	}
	if (value.type === 'view') {
		return {
			type: 'view',
			...(typeof value.resolution === 'string' && { resolution: value.resolution }),
			...(isNumber(value.from) && isNumber(value.to) && { from: value.from, to: value.to })
		}
	}
	if (typeof value.id !== 'string' || !isNumber(value.number)) return null
	const base = { id: value.id, number: value.number }
	const text = typeof value.text === 'string' && value.text ? value.text : undefined
	if (value.type === 'event') return normalizeEventOp(value, base)
	if (value.type === 'hline' && isNumber(value.price)) {
		return { type: 'hline', ...base, price: value.price, ...(text && { text }) }
	}
	if (value.type === 'vline' && isNumber(value.time)) {
		return { type: 'vline', ...base, time: value.time, ...(text && { text }) }
	}
	if (value.type === 'label' && isNumber(value.time) && isNumber(value.price) && text) {
		return { type: 'label', ...base, time: value.time, price: value.price, text }
	}
	if (
		value.type === 'zone' &&
		isNumber(value.from) &&
		isNumber(value.to) &&
		isNumber(value.low) &&
		isNumber(value.high)
	) {
		return {
			type: 'zone',
			...base,
			from: value.from,
			to: value.to,
			low: value.low,
			high: value.high,
			...(text && { text })
		}
	}
	if (value.type === 'marks' && text && Array.isArray(value.marks)) {
		const marks = value.marks.map(markOf).filter((mark): mark is TerminalOpMark => mark !== null)
		if (marks.length > 0) return { type: 'marks', ...base, text, marks }
	}
	if (value.type === 'trades' && text && Array.isArray(value.fills)) {
		const fills = value.fills.map(fillOf).filter((fill): fill is TradeFill => fill !== null)
		if (fills.length > 0) return { type: 'trades', ...base, text, fills }
	}
	if (
		value.type === 'series' &&
		text &&
		Array.isArray(value.points) &&
		value.points.length > 0 &&
		value.points.every(isSeriesPoint)
	) {
		const style: TerminalSeriesStyle = value.style === 'histogram' || value.style === 'area' ? value.style : 'line'
		const placement: TerminalSeriesPlacement = value.placement === 'overlay' ? 'overlay' : 'pane'
		return { type: 'series', ...base, text, style, placement, points: value.points as Array<AgentSeriesPoint> }
	}
	if (
		value.type === 'trendline' &&
		Array.isArray(value.points) &&
		value.points.length === 2 &&
		value.points.every(isPoint)
	) {
		const [from, to] = value.points as [TerminalOpPoint, TerminalOpPoint]
		return { type: 'trendline', ...base, points: [from, to], ...(text && { text }) }
	}
	return null
}

export function normalizeTerminalOpsPayload(value: unknown): TerminalOpsPayload | null {
	if (!isRecord(value) || typeof value.symbol !== 'string' || !value.symbol || !Array.isArray(value.ops)) return null
	const ops = value.ops.map(normalizeOp).filter((op): op is TerminalOp => op !== null)
	if (ops.length === 0) return null
	return { symbol: value.symbol, interval: typeof value.interval === 'string' ? value.interval : '', ops }
}

const isDrawOp = (op: TerminalOp | null): op is TerminalDrawOp => !!op && 'id' in op

export function normalizeTerminalChatState(value: unknown): TerminalChatState | null {
	if (!isRecord(value) || typeof value.symbol !== 'string' || !value.symbol || !Array.isArray(value.ops)) return null
	const scripts = Array.isArray(value.scripts) ? value.scripts : []
	return {
		symbol: value.symbol,
		interval: typeof value.interval === 'string' ? value.interval : '',
		ops: value.ops.map(normalizeOp).filter(isDrawOp),
		scripts: scripts
			.map((script) => normalizeOp(isRecord(script) ? { ...script, type: 'script' } : null))
			.filter((op): op is Extract<TerminalOp, { type: 'script' }> => op?.type === 'script')
			.map(({ file, inputs }) => ({ file, inputs }))
	}
}

// The agent's drawings, keyed by the backend's ai_* id: re-sending an id replaces one drawing.
const drawings = new Map<string, TerminalDrawOp>()
// One op can own several entities. Events and marks sets own none: they are time-axis badges the
// datafeed serves.
const entityIds = new Map<string, Array<string>>()
let drawnSymbol: string | null = null
let drawnInterval: string | null = null
let pendingInterval: string | null = null
let held: Array<TerminalOpsPayload> | null = null
let queue: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<void>) {
	queue = queue.then(task).catch(() => undefined)
}

function chartForDrawings(): TerminalChart | null {
	if (!drawnSymbol || drawnSymbol !== getTerminalSymbol()) return null
	return getTerminalWidget()?.activeChart() ?? null
}

// A clear names the ids it is clearing. Honouring them is what lets a saved indicator drop its own
// stale drawings on a re-run without wiping the drawings the agent made in chat.
function removeDrawings(chart: TerminalChart, ids?: Array<string>) {
	const targets = ids && ids.length > 0 ? ids : [...entityIds.keys()]
	for (const opId of targets) {
		const owned = entityIds.get(opId) ?? []
		entityIds.delete(opId)
		for (const entityId of owned) removeEntity(chart, entityId)
	}
}

// Ownership of a symbol has to change synchronously, or a payload that lands between a symbol
// switch and the queued cleanup is drawn on the wrong chart, or dropped.
function discardDrawings() {
	drawings.clear()
	syncBadges()
	const stale = Array.from(entityIds.values()).flat()
	entityIds.clear()
	if (stale.length === 0) return
	enqueue(async () => {
		const chart = getTerminalWidget()?.activeChart() ?? null
		if (!chart) return
		for (const entityId of stale) removeEntity(chart, entityId)
	})
}

function removeEntity(chart: TerminalChart, entityId: string) {
	try {
		chart.removeEntity(entityId)
	} catch {
		// The user can delete an agent drawing themselves, which leaves a stale id here.
	}
}

// Drop drawings the user deleted, so the agent is never told about one that is gone.
export function pruneDeletedTerminalDrawings() {
	const chart = chartForDrawings()
	if (!chart) return
	let live: Set<string>
	try {
		live = new Set(chart.getAllShapes().map((shape) => shape.id))
	} catch {
		return
	}
	let pruned = false
	for (const [opId, ids] of entityIds) {
		// getAllShapes never lists a study, so a study-backed op would look deleted on the next turn.
		const kind = drawings.get(opId)?.type
		if (kind === 'series' || kind === 'trades' || ids.some((entityId) => live.has(entityId))) continue
		entityIds.delete(opId)
		drawings.delete(opId)
		pruned = true
	}
	if (pruned) scheduleTerminalChatSave()
}

function movedOp(op: TerminalDrawOp, points: Array<TerminalOpPoint>, text: string | undefined): TerminalDrawOp | null {
	const [first, second] = points
	if (!first) return null
	const labelled = { ...op, ...(text ? { text } : op.type !== 'label' && { text: undefined }) }
	if (labelled.type === 'hline') return { ...labelled, price: first.price }
	if (labelled.type === 'vline') return { ...labelled, time: first.time }
	if (labelled.type === 'label') return { ...labelled, time: first.time, price: first.price }
	if (!second) return null
	if (labelled.type === 'trendline') return { ...labelled, points: [first, second] }
	if (labelled.type === 'zone') {
		return {
			...labelled,
			from: Math.min(first.time, second.time),
			to: Math.max(first.time, second.time),
			low: Math.min(first.price, second.price),
			high: Math.max(first.price, second.price)
		}
	}
	return null
}

export function syncTerminalDrawing(entityId: string) {
	const chart = chartForDrawings()
	const opId = [...entityIds].find(([, ids]) => ids.includes(entityId))?.[0]
	const op = opId ? drawings.get(opId) : undefined
	if (!chart || !op) return
	let points: Array<TerminalOpPoint>
	let label: unknown
	try {
		const shape = chart.getShapeById(entityId)
		points = shape.getPoints().map(({ time, price }) => ({ time, price }))
		label = shape.getProperties().text
	} catch {
		return
	}
	const prefix = `${op.number} `
	const text =
		typeof label !== 'string'
			? op.text
			: label === String(op.number)
				? undefined
				: label.startsWith(prefix)
					? label.slice(prefix.length)
					: label
	const next = movedOp(op, points, text)
	if (!next || JSON.stringify(next) === JSON.stringify(op)) return
	drawings.set(op.id, next)
	scheduleTerminalChatSave()
}

// The study binds to a ticker, so the points are handed to the datafeed and the op only carries
// the address. Its own pane unless the op asks to share the price scale.
async function drawSeries(chart: TerminalChart, op: Extract<TerminalDrawOp, { type: 'series' }>) {
	const ticker = registerAgentSeries(op.id, `${op.number} ${op.text}`, op.points)
	const entityId = await chart.createStudy(STUDY_NAME, op.placement === 'overlay', false, {
		[SOURCE_INPUT_ID]: ticker
	})
	if (!entityId) return
	entityIds.set(op.id, [entityId])
	try {
		chart.getStudyById(entityId).applyOverrides({ [`${PLOT_TITLE}.plottype`]: SERIES_STYLES[op.style] })
	} catch {
		// A study the user removed between creation and styling is not worth reporting.
	}
}

// Every fill of a backtest in ONE study, bound to a ticker the same way a series is.
async function drawTrades(chart: TerminalChart, op: Extract<TerminalDrawOp, { type: 'trades' }>) {
	const ticker = registerAgentBars(op.id, `${op.number} ${op.text}`, tradeBars(op.fills))
	const entityId = await chart.createStudy(TRADES_STUDY_NAME, false, false, { [SOURCE_INPUT_ID]: ticker })
	if (entityId) entityIds.set(op.id, [entityId])
}

function isBadge(op: TerminalDrawOp): op is Extract<TerminalDrawOp, { type: 'event' | 'marks' }> {
	return op.type === 'event' || op.type === 'marks'
}

function badgesOf(op: TerminalDrawOp): Array<AgentMark> {
	if (op.type === 'event') return [eventMark(op)]
	if (op.type !== 'marks') return []
	return op.marks.map((mark) => ({
		time: mark.time,
		number: op.number,
		title: mark.text ?? op.text,
		...(mark.text && mark.text !== op.text && { reason: op.text }),
		...(mark.color && { color: mark.color })
	}))
}

let servedBadges = ''

// clearMarks first: refreshMarks alone keeps a badge the new set no longer has.
function refreshTimescaleMarks() {
	try {
		const chart = getTerminalWidget()?.activeChart()
		chart?.clearMarks(TIMESCALE_MARKS)
		chart?.refreshMarks()
	} catch {
		// A widget with no painted chart yet asks the datafeed for marks on its own.
	}
}

// A saved script re-applies its ops on every pan, so marks refresh only when the set changed.
function syncBadges() {
	const marks = [...drawings.values()].flatMap(badgesOf)
	const next = JSON.stringify([drawnSymbol, marks])
	if (next === servedBadges) return
	servedBadges = next
	setAgentMarks(drawnSymbol, marks)
	refreshTimescaleMarks()
}

function layerShows(op: TerminalDrawOp): boolean {
	const layers = getTerminalLayers()
	return op.type === 'trades' ? layers.trades : layers.drawings
}

async function drawOp(chart: TerminalChart, op: TerminalDrawOp) {
	const existing = entityIds.get(op.id)
	if (existing) {
		entityIds.delete(op.id)
		for (const entityId of existing) removeEntity(chart, entityId)
	}
	if (isBadge(op) || !layerShows(op)) return
	if (op.type === 'series') return drawSeries(chart, op)
	if (op.type === 'trades') return drawTrades(chart, op)
	const options: Parameters<TerminalChart['createShape']>[1] = {
		shape: op.type === 'trendline' ? 'trend_line' : op.type === 'zone' ? 'rectangle' : SHAPE_BY_TYPE[op.type],
		text: op.text ? `${op.number} ${op.text}` : String(op.number),
		lock: false,
		disableSelection: false,
		disableSave: true,
		disableUndo: true
	}
	const entityId =
		op.type === 'trendline'
			? await chart.createMultipointShape(op.points, options)
			: op.type === 'zone'
				? await chart.createMultipointShape(
						[
							{ time: op.from, price: op.high },
							{ time: op.to, price: op.low }
						],
						options
					)
				: await chart.createShape(
						op.type === 'hline'
							? { time: Math.floor(Date.now() / 1000), price: op.price }
							: op.type === 'vline'
								? { time: op.time }
								: { time: op.time, price: op.price },
						options
					)
	if (entityId) entityIds.set(op.id, [entityId])
}

/**
 * Adds the DefiLlama study the terminal already serves. Deliberately not tracked as a drawing: it
 * is a study the user owns from here, saved with their layout and removed through the legend, so a
 * `clear` or a symbol change leaves it alone. Re-adding the same series is a no-op.
 */
async function addIndicator(chart: TerminalChart, ticker: string) {
	const already = chart.getAllStudies().some((entry) => {
		if (entry.name !== STUDY_NAME) return false
		const study = chart.getStudyById(entry.id)
		return readSymbolInput(study.getInputValues().find((input) => input.id === SOURCE_INPUT_ID)?.value) === ticker
	})
	if (already) return
	await chart.createStudy(STUDY_NAME, belongsOnPricePane(ticker), false, { [SOURCE_INPUT_ID]: ticker })
}

/**
 * The same deal for a built-in study: the user's to keep, saved with their layout, removed through
 * the legend. The backend resolved the name against this build's own catalogue, so it is exact.
 * Re-adding the same study with the same settings is a no-op; different settings is a second study,
 * which is what an RSI 14 next to an RSI 50 is.
 */
async function addStudy(chart: TerminalChart, name: string, inputs: TerminalStudyInputs) {
	const already = chart.getAllStudies().some((entry) => {
		if (entry.name !== name) return false
		const values = chart.getStudyById(entry.id).getInputValues()
		return Object.entries(inputs).every(([id, value]) => values.find((input) => input.id === id)?.value === value)
	})
	if (already) return
	try {
		// Pane placement is the study's own is_price_study, so forceOverlay stays false: an overlay
		// lands on the price and an oscillator gets its own pane without being told.
		await chart.createStudy(name, false, false, inputs)
	} catch {
		// createStudy REJECTS on a name this build does not know. The rest of the payload still applies.
	}
}

// Awaiting both is what makes the datafeed fetch the new range before anything is drawn on it.
async function applyView(chart: TerminalChart, op: { resolution?: string; from?: number; to?: number }) {
	try {
		if (op.resolution) await chart.setResolution(op.resolution)
		if (op.from !== undefined && op.to !== undefined) await chart.setVisibleRange({ from: op.from, to: op.to })
	} catch {
		// A range the feed cannot cover leaves the chart where it was; the drawings still apply.
	}
}

async function applyPendingInterval(chart: TerminalChart) {
	if (!pendingInterval) return
	const resolution = pendingInterval
	pendingInterval = null
	await applyView(chart, { resolution })
}

export function applyTerminalOps(payload: TerminalOpsPayload) {
	if (held) {
		held.push(payload)
		return
	}
	applyOps(payload)
	scheduleTerminalChatSave()
}

export function holdTerminalOps() {
	held = []
}

export function releaseTerminalOps(): Array<TerminalOpsPayload> {
	const pending = held ?? []
	held = null
	return pending
}

function applyOps(payload: TerminalOpsPayload) {
	// Drawings belong to the symbol they were drawn on; a new symbol starts from an empty set.
	if (payload.symbol !== drawnSymbol) {
		discardDrawings()
		drawnSymbol = payload.symbol
	}
	if (payload.interval) drawnInterval = payload.interval
	for (const op of payload.ops) {
		if (op.type === 'clear') {
			if (op.ids.length > 0) for (const id of op.ids) drawings.delete(id)
			else drawings.clear()
		} else if (op.type === 'script') registerTerminalScript(op.file, op.inputs)
		else if (op.type !== 'view' && op.type !== 'indicator') drawings.set(op.id, op)
	}
	syncBadges()
	enqueue(async () => {
		const chart = chartForDrawings()
		if (!chart) return
		await applyPendingInterval(chart)
		for (const op of payload.ops) {
			// A view moves the chart first, so the datafeed loads the range the drawings need.
			if (op.type === 'view') await applyView(chart, op)
			// Only the entities we created are removed, so the user's own drawings survive a clear.
			else if (op.type === 'clear') removeDrawings(chart, op.ids)
			else if (op.type === 'script') continue
			else if (op.type === 'indicator')
				await ('study' in op ? addStudy(chart, op.study, op.inputs ?? {}) : addIndicator(chart, op.ticker))
			else await drawOp(chart, op)
		}
	})
}

export function replayTerminalDrawings() {
	enqueue(async () => {
		entityIds.clear()
		const chart = chartForDrawings()
		if (!chart) return
		await applyPendingInterval(chart)
		for (const op of drawings.values()) await drawOp(chart, op)
	})
}

export function followTerminalSymbol(chart: TerminalChart) {
	if (chartTicker(chart) !== drawnSymbol) return resetTerminalDrawings()
	chart.dataReady(() =>
		enqueue(async () => {
			const drawn = chartForDrawings()
			if (!drawn) return
			await applyPendingInterval(drawn)
			for (const op of drawings.values()) await drawOp(drawn, op)
		})
	)
}

export function resetTerminalDrawings() {
	drawnSymbol = null
	drawnInterval = null
	pendingInterval = null
	discardDrawings()
}

// Hidden is visual only: the ops stay, so the agent is still told about every drawing it made.
export function applyTerminalLayers() {
	pruneDeletedTerminalDrawings()
	enqueue(async () => {
		const chart = chartForDrawings()
		if (!chart) return
		for (const op of drawings.values()) {
			if (isBadge(op)) continue
			const drawn = entityIds.has(op.id)
			if (drawn && !layerShows(op)) removeDrawings(chart, [op.id])
			else if (!drawn && layerShows(op)) await drawOp(chart, op)
		}
	})
	refreshTimescaleMarks()
}

export function forgetTerminalScripts() {
	resetTerminalScripts()
	resetTerminalIndicatorRuns()
}

// The user's own drawings and studies are never in `drawings`, so they survive. The scripts go too,
// or the next pan re-runs one and its drawings come straight back.
export function clearTerminalAgentDrawings() {
	forgetTerminalScripts()
	if (drawnSymbol) applyTerminalOps({ symbol: drawnSymbol, interval: '', ops: [{ type: 'clear', ids: [] }] })
	else scheduleTerminalChatSave()
}

// What the chart shows right now, as the backend's resolveTerminalContext expects it.
export interface TerminalContextPayload {
	symbol: string
	interval: string
	from: number
	to: number
	drawings: Array<{ id: string; kind: string; label?: string }>
}

const FALLBACK_INTERVAL = '1D'
const FALLBACK_RANGE_SECONDS = 90 * 24 * 60 * 60
const FALLBACK_BAR_SECONDS = 24 * 60 * 60

function readChartRange(): { interval: string; from: number; to: number } | null {
	try {
		const chart = getTerminalWidget()?.activeChart()
		if (!chart) return null
		const range = chart.getVisibleRange()
		if (!isNumber(range?.from) || !isNumber(range?.to) || range.to <= range.from) return null
		return { interval: chart.resolution(), from: Math.floor(range.from), to: Math.floor(range.to) }
	} catch {
		// A widget that exists but has no painted chart yet throws here; the turn still has to go out.
		return null
	}
}

export function readTerminalContext(): TerminalContextPayload {
	pruneDeletedTerminalDrawings()
	// Floored to the fallback bar, not left on the wall clock: a symbol change runs the scripts
	// before the new chart has painted, so two runs a second apart both take this branch and differ
	// only in that second. That is a different run key, so the client dedupe misses, and the two
	// overlap in flight so the server cache is not warm either — the script runs twice for real.
	const now = Math.floor(Date.now() / 1000 / FALLBACK_BAR_SECONDS) * FALLBACK_BAR_SECONDS
	const range = readChartRange() ?? { interval: FALLBACK_INTERVAL, from: now - FALLBACK_RANGE_SECONDS, to: now }
	const symbol = getTerminalSymbol()
	return {
		symbol,
		interval: range.interval,
		from: range.from,
		to: range.to,
		// Drawings belong to the symbol they were drawn on, so a stale set is no set.
		drawings:
			drawnSymbol === symbol
				? [...drawings.values()].map((op) => ({ id: op.id, kind: op.type, ...(op.text && { label: op.text }) }))
				: []
	}
}

// The symbol of the last chart turn, so reopening a conversation lands on the chart it was about.
export function terminalSymbolOf(messages: Array<{ terminalOps?: TerminalOpsPayload }>): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const symbol = messages[i].terminalOps?.symbol
		if (symbol) return symbol
	}
	return null
}

export function restoreTerminalDrawings(messages: Array<{ terminalOps?: TerminalOpsPayload }>) {
	forgetTerminalScripts()
	resetTerminalDrawings()
	for (const message of messages) {
		if (message.terminalOps) applyOps(message.terminalOps)
	}
}

export function readTerminalChatState(): TerminalChatState {
	return {
		symbol: drawnSymbol ?? getTerminalSymbol(),
		interval: pendingInterval ?? readChartRange()?.interval ?? drawnInterval ?? FALLBACK_INTERVAL,
		ops: [...drawings.values()],
		scripts: listTerminalScriptRefs()
	}
}

export function restoreTerminalChatState(state: TerminalChatState) {
	for (const script of state.scripts) registerTerminalScript(script.file, script.inputs)
	pendingInterval = state.interval || null
	applyOps({ symbol: state.symbol, interval: state.interval, ops: state.ops })
}
