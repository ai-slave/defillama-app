import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { studyCatalogFrom } from '../terminalData'
import {
	applyTerminalOps,
	normalizeTerminalOpsPayload,
	readTerminalContext,
	resetTerminalDrawings,
	type TerminalStudyInputs
} from '../terminalOps'
import { setTerminalSymbol, setTerminalWidget, type TerminalChart, type TerminalWidget } from '../terminalViewStore'

/**
 * A built-in study is the user's from the moment it lands: their layout saves it and the legend
 * removes it. The agent only names it. Each case here is a way that hand-off breaks — an unknown
 * name rejecting inside a queue nobody awaits, a positional input landing in the wrong slot, or a
 * study the agent starts treating as its own drawing.
 */

interface CreatedStudy {
	name: string
	overlay: boolean
	inputs: TerminalStudyInputs
}

const created: Array<CreatedStudy> = []
const onChart: Array<{ id: string; name: string; inputs: TerminalStudyInputs }> = []
let rejectName: string | null = null
let nextEntity = 0

function recordingWidget(): TerminalWidget {
	const chart = {
		createStudy: async (name: string, overlay: boolean, _lock: boolean, inputs: TerminalStudyInputs = {}) => {
			// The library rejects the promise on a name it does not know; it never resolves null.
			if (name === rejectName) throw new Error(`unexpected study id:${name.toLowerCase()}`)
			const id = `entity_${++nextEntity}`
			created.push({ name, overlay, inputs })
			onChart.push({ id, name, inputs })
			return id
		},
		createShape: async () => `entity_${++nextEntity}`,
		getAllStudies: () => onChart.map((study) => ({ id: study.id, name: study.name })),
		getStudyById: (id: string) => ({
			getInputValues: () =>
				Object.entries(onChart.find((study) => study.id === id)?.inputs ?? {}).map(([inputId, value]) => ({
					id: inputId,
					value
				})),
			applyOverrides: () => undefined
		}),
		removeEntity: (id: string) => {
			const at = onChart.findIndex((study) => study.id === id)
			if (at >= 0) onChart.splice(at, 1)
		},
		getAllShapes: () => [],
		getVisibleRange: () => ({ from: 1_700_000_000, to: 1_700_086_400 }),
		resolution: () => '1D'
	} as unknown as TerminalChart
	return { activeChart: () => chart } as unknown as TerminalWidget
}

const studyPayload = (study: string, inputs?: TerminalStudyInputs) => ({
	symbol: 'HYPE',
	interval: '1D',
	ops: [{ type: 'indicator' as const, study, label: study, ...(inputs && { inputs }) }]
})

const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
	created.length = 0
	onChart.length = 0
	rejectName = null
	nextEntity = 0
	setTerminalSymbol('HYPE')
	setTerminalWidget(recordingWidget())
})

afterEach(async () => {
	setTerminalWidget(null)
	resetTerminalDrawings()
	await drain()
})

describe('a built-in study is created by the name the backend resolved', () => {
	test('inputs reach createStudy keyed by id, in an object', async () => {
		applyTerminalOps(studyPayload('MACD', { in_0: 8, in_2: 5, in_3: 'hlc3' }))
		await drain()

		// MACD's first input is `symbol`, so an array would shift every value by one slot.
		expect(created).toEqual([{ name: 'MACD', overlay: false, inputs: { in_0: 8, in_2: 5, in_3: 'hlc3' } }])
	})

	test('the pane is the library’s call, so forceOverlay is never forced', async () => {
		applyTerminalOps(studyPayload('Bollinger Bands'))
		applyTerminalOps(studyPayload('Relative Strength Index'))
		await drain()

		// is_price_study puts Bollinger on the price and RSI in a new pane on its own. Passing true
		// for an oscillator would draw it straight over the candles.
		expect(created.map((study) => study.overlay)).toEqual([false, false])
	})

	test('a name this build does not know does not take the rest of the payload down', async () => {
		rejectName = 'Nonexistent Study'
		applyTerminalOps({
			symbol: 'HYPE',
			interval: '1D',
			ops: [
				{ type: 'indicator', study: 'Nonexistent Study', label: 'Nonexistent Study' },
				{ type: 'indicator', study: 'VWAP', label: 'VWAP' }
			]
		})
		await drain()

		expect(created.map((study) => study.name)).toEqual(['VWAP'])
	})
})

describe('re-adding the same study is a no-op, a different setting is a second study', () => {
	test('the same study with the same settings is not added twice', async () => {
		applyTerminalOps(studyPayload('Relative Strength Index', { length: 14 }))
		await drain()
		applyTerminalOps(studyPayload('Relative Strength Index', { length: 14 }))
		await drain()

		expect(created).toHaveLength(1)
	})

	test('a second length is a real second study, not a duplicate', async () => {
		// An RSI 14 read against an RSI 50 is the whole point of asking for the second one.
		applyTerminalOps(studyPayload('Relative Strength Index', { length: 14 }))
		await drain()
		applyTerminalOps(studyPayload('Relative Strength Index', { length: 50 }))
		await drain()

		expect(created.map((study) => study.inputs.length)).toEqual([14, 50])
	})

	test('asking for the defaults twice adds one study', async () => {
		applyTerminalOps(studyPayload('VWAP'))
		await drain()
		applyTerminalOps(studyPayload('VWAP'))
		await drain()

		expect(created).toHaveLength(1)
	})
})

describe('the study belongs to the user, not to the agent', () => {
	test('it is never reported back as one of the agent’s drawings', async () => {
		applyTerminalOps(studyPayload('Relative Strength Index'))
		await drain()

		// Tracking it would let a clear or a symbol change take away something the user now owns.
		expect(readTerminalContext().drawings).toEqual([])
	})

	test('a clear leaves it on the chart', async () => {
		applyTerminalOps(studyPayload('Relative Strength Index'))
		await drain()
		applyTerminalOps({ symbol: 'HYPE', interval: '1D', ops: [{ type: 'clear', ids: [] }] })
		await drain()

		expect(onChart.map((study) => study.name)).toEqual(['Relative Strength Index'])
	})
})

describe('the wire shape is the contract with the backend', () => {
	test('a study op survives normalization with its inputs', () => {
		expect(normalizeTerminalOpsPayload(studyPayload('RSI', { length: 21 }))?.ops).toEqual([
			{ type: 'indicator', study: 'RSI', label: 'RSI', inputs: { length: 21 } }
		])
	})

	test('the DefiLlama ticker form is untouched', () => {
		const payload = {
			symbol: 'HYPE',
			interval: '1D',
			ops: [{ type: 'indicator', ticker: 'DEFILLAMA:protocol/aave/tvl', label: 'Aave · Protocol TVL' }]
		}
		expect(normalizeTerminalOpsPayload(payload)?.ops).toEqual(payload.ops)
	})

	test('an indicator op with neither a study nor a ticker is dropped', () => {
		expect(normalizeTerminalOpsPayload({ symbol: 'HYPE', interval: '1D', ops: [{ type: 'indicator' }] })).toBeNull()
	})

	test('an input value that is not a scalar is dropped rather than handed to the library', () => {
		const normalized = normalizeTerminalOpsPayload(studyPayload('RSI', { length: 21, bad: { nested: 1 } } as any))
		expect(normalized?.ops[0]).toEqual({ type: 'indicator', study: 'RSI', label: 'RSI', inputs: { length: 21 } })
	})
})

describe('the catalog the browser reports', () => {
	const metainfos = [
		{
			description: 'Volume',
			shortDescription: 'Volume',
			is_price_study: false,
			inputs: [
				{ id: 'length', name: 'MA Length', type: 'integer', defval: 20, min: 1, max: 2000 },
				{ id: 'showMA', name: 'show MA', type: 'bool', defval: false, isHidden: true }
			]
		},
		{ description: 'Hidden Internal', is_hidden_study: true, inputs: [] },
		{ description: 'VWAP', shortDescription: 'VWAP', is_price_study: true }
	]

	test('drops the inputs the library fills from the viewport', () => {
		// showMA and the volume-profile bar times are machine-populated ranges; an agent that sets
		// one pins the study to a window the user never chose.
		expect(studyCatalogFrom(metainfos)[0].inputs).toEqual([
			{ id: 'length', name: 'MA Length', type: 'integer', defval: 20, min: 1, max: 2000 }
		])
	})

	test('drops studies the library hides from its own picker', () => {
		expect(studyCatalogFrom(metainfos).map((entry) => entry.name)).toEqual(['Volume', 'VWAP'])
	})

	test('keeps shortDescription, which is the only place the acronyms live', () => {
		// "VWAP", "RSI", "ATR" resolve through shortDescription; without it the agent's own
		// vocabulary dead-ends on the backend.
		expect(studyCatalogFrom(metainfos)[1]).toEqual({
			name: 'VWAP',
			shortDescription: 'VWAP',
			is_price_study: true,
			inputs: []
		})
	})
})
