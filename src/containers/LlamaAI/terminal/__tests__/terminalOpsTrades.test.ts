import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
	agentSeriesBars,
	agentSymbolInfo,
	createTerminalStudies,
	SOURCE_INPUT_ID,
	studyBindPeriod,
	tradeBars,
	tradeMarkers,
	TRADES_STUDY_NAME,
	type TerminalPineJs,
	type TradeFill
} from '../terminalData'
import { stripAgentSeries } from '../terminalLayout'
import {
	applyTerminalOps,
	normalizeTerminalOpsPayload,
	readTerminalContext,
	resetTerminalDrawings
} from '../terminalOps'
import { setTerminalSymbol, setTerminalWidget, type TerminalChart, type TerminalWidget } from '../terminalViewStore'

/**
 * A backtest's fills are a study, not drawings: the library has no size control over a drawing, and
 * a study can say `tiny`. The cost is that a study belongs to the user's saved layout with no
 * `disableSave` to opt out of it, so every case here guards one half of that trade — the fills
 * reach the chart at their own prices, and the study never survives into the layout.
 */

const DAY = 86_400
const HOUR = 3600
const START = 1_700_000_000 - (1_700_000_000 % DAY)

const studies: Array<{ id: string; name: string; overlay: boolean; inputs: Record<string, string> }> = []
const removed: Array<string> = []
let nextEntity = 0

function recordingWidget(): TerminalWidget {
	const chart = {
		createShape: async () => `entity_${++nextEntity}`,
		createMultipointShape: async () => `entity_${++nextEntity}`,
		createStudy: async (name: string, overlay: boolean, _lock: boolean, inputs: Record<string, string>) => {
			const id = `entity_${++nextEntity}`
			studies.push({ id, name, overlay, inputs })
			return id
		},
		getStudyById: () => ({ applyOverrides: () => undefined }),
		removeEntity: (id: string) => removed.push(id),
		getAllShapes: () => [],
		getVisibleRange: () => ({ from: START, to: START + 30 * DAY }),
		resolution: () => '1D'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

const tradesOp = (id = 'ai_1', fills = defaultFills) => ({
	symbol: 'AAVE',
	interval: '1D',
	ops: [{ type: 'trades' as const, id, number: Number(id.slice(3)), text: 'SMA-50 trades', fills }]
})

const defaultFills = [
	{ time: START + DAY, price: 31.5, kind: 'long_entry' as const },
	{ time: START + 3 * DAY, price: 34.05, kind: 'long_exit' as const },
	{ time: START + 5 * DAY, price: 34, kind: 'short_entry' as const },
	{ time: START + 7 * DAY, price: 30.2, kind: 'short_exit' as const }
]

const apply = async (payload: ReturnType<typeof tradesOp>) => {
	applyTerminalOps(payload)
	await drain()
}

beforeEach(() => {
	studies.length = 0
	removed.length = 0
	nextEntity = 0
	setTerminalSymbol('AAVE')
	setTerminalWidget(recordingWidget())
})

afterEach(async () => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	await drain()
	setTerminalSymbol('HYPE')
})

describe('the study that draws the fills', () => {
	const trades = async () => {
		const [, entry] = await createTerminalStudies()(pineStub())
		return entry
	}

	test('every shapes plot carries the metainfo style entry the pane view demands', async () => {
		const study = (await trades()) as any
		const plots = study.metainfo.plots

		// The shapes pane view does ensureDefined(metaInfo().styles[plot]) and throws without it,
		// which takes the whole chart down rather than dropping one marker.
		expect(plots.map((plot: any) => plot.type)).toEqual(['shapes', 'shapes', 'shapes', 'shapes'])
		for (const plot of plots) {
			expect(study.metainfo.styles[plot.id], plot.id).toMatchObject({ size: 'tiny' })
		}
	})

	// A marker on the fill price sits mid-candle over the wick, where the candle hides it. Clear of
	// the bar it is also unambiguous about which way the fill went, now that nothing is labelled.
	test('a buy is a green triangle under the bar and a sell a red one over it', async () => {
		const styles = ((await trades()) as any).metainfo.defaults.styles
		const buy = ['shape_triangle_up', 'BelowBar', '#089981']
		const sell = ['shape_triangle_down', 'AboveBar', '#cc2f3c']
		expect(
			[0, 1, 2, 3].map((i) => [styles[`plot_${i}`].plottype, styles[`plot_${i}`].location, styles[`plot_${i}`].color])
		).toEqual([buy, sell, sell, buy])
	})

	// The study reads the bound ticker's OHLC fields; tradeBars writes them. A swap between the two
	// puts a long entry's triangle on the short exit's plot, which is a green up arrow on an exit.
	test('a fill becomes a marker at its price, and a bar with no fill of that kind is NaN', () => {
		expect(tradeMarkers({ open: 31.5, high: 0, low: 0, close: 0 })).toEqual([31.5, NaN, NaN, NaN])
		expect(tradeMarkers({ open: 0, high: 34.05, low: 34, close: 0 })).toEqual([NaN, 34.05, 34, NaN])
		expect(tradeMarkers({ open: 0, high: 0, low: 0, close: 30.2 })).toEqual([NaN, NaN, NaN, 30.2])
	})

	test('a study left with no ticker plots nothing', () => {
		expect(tradeMarkers(null)).toEqual([NaN, NaN, NaN, NaN])
	})

	// A 1h backtest of 8 trades drew 6 markers: the ticker offered nothing but '1D' and the study
	// asked for '1D', so the fills of a whole UTC day landed on one bar and the last one won.
	test('two fills of one kind an hour apart keep their own bars on an hourly chart', () => {
		const hourly: Array<TradeFill> = [
			{ time: START + 9 * HOUR, price: 31.5, kind: 'long_entry' },
			{ time: START + 10 * HOUR, price: 32.1, kind: 'long_entry' }
		]

		expect(studyBindPeriod('trades', '60')).toBe('60')
		const info = agentSymbolInfo('LLAMAAI:ai_1.1', 'Trades')
		expect(info.has_intraday).toBe(true)
		expect(info.supported_resolutions).toBeUndefined()
		expect(tradeBars(hourly).map((bar) => bar.time)).toEqual([START + 9 * HOUR, START + 10 * HOUR])
	})

	// The series study shares this ticker's metainfo, and a series carries one point a day. It asks
	// for the daily grid whatever the chart shows, so an hourly chart still draws the daily line.
	test('a daily agent series stays on the daily grid when the chart is hourly', () => {
		expect(studyBindPeriod('series', '60')).toBe('1D')
	})
})

describe('the fills reach the datafeed through one ticker', () => {
	test('each kind rides in its own OHLC field and an empty kind stays zero', () => {
		expect(tradeBars(defaultFills)).toEqual([
			{ time: START + DAY, open: 31.5, high: 0, low: 0, close: 0 },
			{ time: START + 3 * DAY, open: 0, high: 34.05, low: 0, close: 0 },
			{ time: START + 5 * DAY, open: 0, high: 0, low: 34, close: 0 },
			{ time: START + 7 * DAY, open: 0, high: 0, low: 0, close: 30.2 }
		])
	})

	// A family with no fills at all would be a ticker with no bars, and a study whose secondary
	// symbol has no data does not compute — an all-long backtest would draw nothing.
	test('two kinds on one bar share it, and the bars come back in time order', () => {
		expect(
			tradeBars([
				{ time: START + 3 * DAY, price: 34.05, kind: 'long_exit' },
				{ time: START + DAY, price: 31.5, kind: 'long_entry' },
				{ time: START + 3 * DAY, price: 34.05, kind: 'short_entry' }
			])
		).toEqual([
			{ time: START + DAY, open: 31.5, high: 0, low: 0, close: 0 },
			{ time: START + 3 * DAY, open: 0, high: 34.05, low: 34.05, close: 0 }
		])
	})

	test('the op binds one study to a ticker that serves the fills', async () => {
		await apply(tradesOp())

		expect(studies).toHaveLength(1)
		expect(studies[0].name).toBe(TRADES_STUDY_NAME)
		const ticker = studies[0].inputs[SOURCE_INPUT_ID]
		expect(agentSeriesBars(ticker, { to: START + 30 * DAY, countBack: 0 })).toEqual([
			{ time: (START + DAY) * 1000, open: 31.5, high: 0, low: 0, close: 0, volume: 0 },
			{ time: (START + 3 * DAY) * 1000, open: 0, high: 34.05, low: 0, close: 0, volume: 0 },
			{ time: (START + 5 * DAY) * 1000, open: 0, high: 0, low: 34, close: 0, volume: 0 },
			{ time: (START + 7 * DAY) * 1000, open: 0, high: 0, low: 0, close: 30.2, volume: 0 }
		])
		// One drawing whatever the trade count, and a study is not a shape, so an unguarded prune
		// would report it deleted on the very next turn.
		expect(readTerminalContext().drawings).toEqual([{ id: 'ai_1', kind: 'trades', label: 'SMA-50 trades' }])
	})

	test('re-sending the id replaces the set instead of stacking a second study', async () => {
		await apply(tradesOp())
		const first = studies[0].inputs[SOURCE_INPUT_ID]

		await apply(tradesOp('ai_1', [{ time: START + 2 * DAY, price: 29, kind: 'long_entry' }]))

		expect(removed).toEqual([studies[0].id])
		expect(studies).toHaveLength(2)
		// A reused ticker would have the library serve the previous set's cached bars.
		expect(studies[1].inputs[SOURCE_INPUT_ID]).not.toBe(first)
		expect(agentSeriesBars(first, { to: START + 30 * DAY, countBack: 0 })).toBeNull()
	})

	test('a clear takes the study with it', async () => {
		await apply(tradesOp())
		applyTerminalOps({ symbol: 'AAVE', interval: '1D', ops: [{ type: 'clear', ids: ['ai_1'] }] })
		await drain()

		expect(removed).toEqual([studies[0].id])
		expect(readTerminalContext().drawings).toEqual([])
	})

	test.each([
		['no fills', { fills: [] }],
		['a fill with no price', { fills: [{ time: START + DAY, kind: 'long_entry' }] }],
		['a kind this build cannot draw', { fills: [{ time: START + DAY, price: 31, kind: 'scale_in' }] }],
		['no title for the legend', { text: '' }]
	])('an op with %s is dropped rather than half-drawn', (_case, patch) => {
		const payload = tradesOp()
		expect(normalizeTerminalOpsPayload({ ...payload, ops: [{ ...payload.ops[0], ...patch }] })).toBeNull()
	})
})

/**
 * A study has no `disableSave`, unlike a shape. Saved once, the fills of a backtest the user ran
 * weeks ago come back on every chart they open, bound to a ticker whose points are long gone.
 */
describe('the trades study never reaches the saved layout', () => {
	test('the strip that keeps agent series out covers it too', async () => {
		await apply(tradesOp())
		const ticker = studies[0].inputs[SOURCE_INPUT_ID]
		const layout = {
			charts: [
				{
					panes: [
						{
							sources: [
								{ type: 'MainSeries', id: '_seriesId' },
								{ type: 'Study', id: 'rsi', state: { inputs: { in_0: 14 } } },
								{ type: 'Study', id: 'trades', state: { inputs: { [SOURCE_INPUT_ID]: ticker } } }
							]
						}
					]
				}
			]
		}

		expect(stripAgentSeries(layout).charts[0].panes[0].sources.map((source) => source.id)).toEqual(['_seriesId', 'rsi'])
	})
})

// createTerminalStudies needs the library's Std readers to build its constructors; the metainfo
// cases above never call them.
function pineStub(): TerminalPineJs {
	return {
		Std: {
			open: () => 0,
			high: () => 0,
			low: () => 0,
			close: () => 0
		}
	}
}
