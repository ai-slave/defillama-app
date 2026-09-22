// A "wall" study draws a horizontal histogram against the price axis through the charting
// library's own study-graphics channel. Everything here is shape and library mechanics; where the
// bins come from, what they mean and what they are called belongs to each registration.

export const REVISION_INPUT_ID = 'revision'

/**
 * One bar of the histogram. `near` and `far` are the two sub-bars the library stacks from the
 * axis, drawn in the slot's two colours — for a liquidation map, the long and the short side of
 * the same price. `slot` picks the colour band, and is an index into the config's `slots`.
 */
export interface WallBin {
	priceLow: number
	priceHigh: number
	near: number
	far: number
	slot: number
}

export interface WallSlot {
	title: string
	color: string
}

export interface WallStudyConfig {
	/** Saved layouts embed the metainfo and re-match by id, so this can never change. */
	id: string
	name: string
	/** Carries into the legend and every saved layout: say what the numbers are here. */
	shortDescription: string
	slots: Array<WallSlot>
	subBarTitles: [string, string]
	/** Read synchronously on every recalculation. Null means "no data yet", not "empty". */
	readBins: () => Array<WallBin> | null
}

export interface WallHhist {
	styleId: string
	data: Array<{
		id: string
		priceLow: number
		priceHigh: number
		rate: [number, number]
		firstBarTime: number
		lastBarTime: number
	}>
}

const styleIdFor = (slot: number) => `slot${slot}`

/**
 * Two rules the library enforces silently. Every datum needs its own id, because ingestion keys
 * them by it and anything sharing an id collapses into a single bar. And a wall is a point in
 * time: first and last bar time must be the SAME bar, because the time-index collector registers
 * only the first while the remapper rewrites both, so a span leaves the end undefined and nothing
 * draws at all.
 */
export function wallHhists(bins: Array<WallBin>, barTime: number, slotCount: number): Array<WallHhist> {
	const byStyle = new Map<string, WallHhist>()
	for (const [index, bin] of bins.entries()) {
		if (bin.slot < 0 || bin.slot >= slotCount || (bin.near <= 0 && bin.far <= 0)) continue
		const styleId = styleIdFor(bin.slot)
		const hhist = byStyle.get(styleId) ?? { styleId, data: [] }
		hhist.data.push({
			id: `${styleId}_${index}`,
			priceLow: bin.priceLow,
			priceHigh: bin.priceHigh,
			rate: [bin.near, bin.far],
			firstBarTime: barTime,
			lastBarTime: barTime
		})
		byStyle.set(styleId, hhist)
	}
	return [...byStyle.values()]
}

/**
 * Graphics do not move the price scale, and a bar outside it is both clipped AND still counted in
 * the width normalisation, so one off-screen bar shrinks every visible one. Two invisible plots
 * spanning the bins keep the scale wide enough for all of them.
 */
export function wallScaleBounds(bins: Array<WallBin>): [number, number] {
	let low = Infinity
	let high = 0
	for (const bin of bins) {
		if (bin.near <= 0 && bin.far <= 0) continue
		low = Math.min(low, bin.priceLow)
		high = Math.max(high, bin.priceHigh)
	}
	return high > 0 ? [low, high] : [NaN, NaN]
}

interface WallContext {
	symbol: { time: number; isLastBar?: boolean }
}

interface WallInstance {
	_barTime: number | null
	init: () => void
	main: (context: WallContext) => Array<number> | Record<string, unknown>
}

const HIDDEN_TIME_INPUT = {
	defval: 0,
	isHidden: true,
	max: 253_370_764_800,
	min: -253_370_764_800,
	type: 'time'
}

const INVISIBLE_PLOT = {
	linestyle: 0,
	visible: true,
	linewidth: 1,
	plottype: 0,
	trackPrice: false,
	transparency: 100,
	color: '#000000'
}

/**
 * Builds a study that renders `config.readBins()` as a right-anchored horizontal histogram. The
 * graphics keys and the composite return shape are outside the library's public types, so both
 * are cast at the boundary; everything a second wall study needs to differ in is in the config.
 */
export function wallStudy(config: WallStudyConfig) {
	const entries = config.slots.map((slot, index) => [styleIdFor(index), slot] as const)
	const hhists = Object.fromEntries(
		entries.map(([styleId, slot]) => [
			styleId,
			{ title: slot.title, titles: config.subBarTitles, location: 'relative' }
		])
	)
	const hhistDefaults = Object.fromEntries(
		entries.map(([styleId, slot]) => [
			styleId,
			{
				colors: [slot.color, slot.color],
				transparencies: [20, 45],
				visible: true,
				percentWidth: 26,
				showValues: false,
				valuesColor: '#787b86',
				direction: 'right_to_left'
			}
		])
	)

	return {
		name: config.name,
		metainfo: {
			_metainfoVersion: 51,
			id: config.id,
			description: config.name,
			shortDescription: config.shortDescription,
			is_price_study: true,
			isCustomIndicator: true,
			format: { type: 'price' },
			plots: [
				{ id: 'plot_0', type: 'line' },
				{ id: 'plot_1', type: 'line' }
			],
			styles: { plot_0: { title: 'Scale low' }, plot_1: { title: 'Scale high' } },
			graphics: { hhists },
			defaults: {
				styles: { plot_0: INVISIBLE_PLOT, plot_1: INVISIBLE_PLOT },
				graphics: { hhists: hhistDefaults },
				// The range inputs must be seeded here as well as declared below. Without a default,
				// createStudy never settles: the console throws on setValueSilently and the promise
				// is simply left unresolved, so there is no failure to catch.
				inputs: { volume: 'Up/Down', first_visible_bar_time: 0, last_visible_bar_time: 0, [REVISION_INPUT_ID]: 0 }
			},
			inputs: [
				// Any metainfo carrying hhists is force-wired to the Volume Profile legend provider,
				// which calls inputs.childs().volume.value() unconditionally. Up/Down is the only mode
				// that reports both sub-bars and their true sum; Total labels the first sub-bar alone
				// as the total, and Delta renames every style id out from under the data. Locked to
				// one option so neither can be chosen.
				{ id: 'volume', name: 'Volume', type: 'text', defval: 'Up/Down', options: ['Up/Down'] },
				{ id: 'first_visible_bar_time', name: 'First Visible Bar Time', ...HIDDEN_TIME_INPUT },
				{ id: 'last_visible_bar_time', name: 'Last Visible Bar Time', ...HIDDEN_TIME_INPUT },
				// Bins are fetched outside the study and read synchronously, so a study already on
				// the chart is told the data moved by bumping this.
				{ id: REVISION_INPUT_ID, name: 'Revision', type: 'integer', defval: 0, isHidden: true, min: 0, max: 1e9 }
			]
		},
		constructor: function WallStudy(this: WallInstance) {
			this.init = () => {
				this._barTime = null
			}
			this.main = (context) => {
				const time = context.symbol.time
				if (typeof time === 'number' && isFinite(time)) this._barTime = time
				// The library re-feeds the visible-range inputs and forces a recalculation on every
				// pan and zoom, so the anchor is taken fresh each pass rather than remembered.
				if (context.symbol.isLastBar === false || this._barTime === null) return [NaN, NaN]
				const bins = config.readBins()
				if (!bins || bins.length === 0) return [NaN, NaN]
				const graphics = wallHhists(bins, this._barTime, config.slots.length)
				if (graphics.length === 0) return [NaN, NaN]
				return {
					type: 'composite',
					data: [
						wallScaleBounds(bins),
						{
							nonseries: true,
							type: 'study_graphics',
							data: { graphicsCmds: { create: { hhists: graphics }, erase: [{ action: 'all' }] } }
						}
					]
				}
			}
		}
	}
}
