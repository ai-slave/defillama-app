export const oldBlue = '#1f67d2'

/* Chart series colors: the one categorical palette (design.md → Charts). Ten colors, each at 3:1 or more on the
   white card, light page, dark card and dark page, so one list serves both modes and PNG exports. Found by search
   in OKLCH for the widest separation between any two colors for normal and red–green color-blind vision, and
   ordered so neighbors differ most, because series take colors by rank. Brand blue stays first for
   single-series charts. Brand colors that come with the data (stablecoins, partner dashboards) are kept. */
export const CHART_COLORS: [string, string, string, ...Array<string>] = [
	oldBlue,
	'#ed5f18', // orange
	'#039c89', // teal
	'#9781da', // lavender
	'#825b0c', // ochre
	'#509b31', // green
	'#a738a2', // magenta
	'#057558', // deep green
	'#e06283', // pink
	'#c32851' // crimson
]

/** Past this many series a chart folds the rest into one "Others" series: more colors than this cannot be told apart. */
export const CHART_SERIES_LIMIT = 10

/** The "Others" series: a neutral gray at 3:1 or more on every chart background, so it reads as the remainder. */
export const OTHERS_COLOR = '#8a8d8f'

/** The color for the series at this rank. Past CHART_SERIES_LIMIT callers fold into Others, or MultiSeriesChart
   recolors a stack that shows every series by overlap (`assignStackColors`), so the cycle is only a fallback. */
export function chartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length] ?? oldBlue
}

/**
 * Colors for series in draw order, each its own while the palette lasts. A series keeps its color unless one drawn
 * before it took that color (a pick from past CHART_SERIES_LIMIT wraps onto a top color, and a page-wide color can
 * match another series'); those take the palette colors nothing drawn uses, in draw order. A pie and a stack of at
 * most CHART_SERIES_LIMIT series both use it, so they color the same picks alike.
 */
export function assignUniqueColors(series: ReadonlyArray<{ name: string; color: string }>): Record<string, string> {
	const colors: Record<string, string> = {}
	const used = new Set<string>()
	const repeated: Array<string> = []
	for (const item of series) {
		if (used.has(item.color)) {
			repeated.push(item.name)
			continue
		}
		used.add(item.color)
		colors[item.name] = item.color
	}
	let next = 0
	for (const name of repeated) {
		while (next < CHART_SERIES_LIMIT && used.has(chartColor(next))) next++
		colors[name] = chartColor(next++)
	}
	return colors
}

/** Colors for `count` series in rank order. */
export function chartColors(count: number): Array<string> {
	return Array.from({ length: count }, (_, index) => chartColor(index))
}

/** Rising and falling fills that text sits on (heat cells, the value scale), the same in both modes: emerald-9 and a
   crimson at its OKLCH lightness and chroma, because crimson-9 is far more saturated and outweighs the green. */
export const HEAT_UP = '#007b45'
export const HEAT_DOWN = '#a5464a'

/** Rising and falling marks (bars, candles, Sankey links) as CSS variables: they follow the mode (semantics.css
   --chart-up/--chart-down), resolve in the DOM as they are, and the chart renderers resolve them through the chart
   theme for the canvas, so a cached chart payload never has to know the theme. */
export const CHART_UP = 'var(--chart-up)'
export const CHART_DOWN = 'var(--chart-down)'

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function toOklab(hex: string): [number, number, number] {
	const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	]
}

function fromOklab([L, A, B]: [number, number, number]): string {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
	const rgb = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	]
	return `#${rgb
		.map((v) =>
			Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`
}

/** Treemap children: lighter steps of the parent's color in OKLab, so siblings read as one family in both modes. */
export function childColors(parent: string, count: number): Array<string> {
	const [L, A, B] = toOklab(parent)
	return Array.from({ length: count }, (_, index) => {
		if (index === 0) return parent
		const t = index / count
		return fromOklab([Math.min(0.92, L + 0.22 * t), A * (1 - 0.45 * t), B * (1 - 0.45 * t)])
	})
}

/** The one value scale (design.md → Charts): -1 is HEAT_DOWN, 0 the Others gray, 1 HEAT_UP, mixed in OKLab. Callers
   map their value onto -1..1 (a % change over its cap, a correlation, a 0-100 score around 50); outside is clamped. */
export function divergingColor(t: number): string {
	const clamped = Math.max(-1, Math.min(1, t))
	const [from, to] = [toOklab(OTHERS_COLOR), toOklab(clamped < 0 ? HEAT_DOWN : HEAT_UP)]
	const k = Math.abs(clamped)
	return fromOklab([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k])
}

/** Crypto asset brand colors shared by the ETF, DAT and exchange research charts, as [light, dark]: a brand under 3:1
   on a chart background in one mode moves its lightness (OKLCH, same hue) just far enough there; one that passes keeps
   its hex in both. */
export const ASSET_BRAND_COLORS = {
	Bitcoin: ['#d27a02', '#f7931a'],
	Ethereum: ['#627eea', '#627eea'],
	Solana: ['#9945FF', '#9945FF'],
	Hyperliquid: ['#0ea091', '#50d2c1']
} as const satisfies Record<string, readonly [light: string, dark: string]>

/** The token rating page's metric colors, as [light, dark]: each one names a metric on every chart of the page
   (market cap blue, volume gold, depth purple, the depth chart's market cap green, and the two bands of the volume and
   depth stacks). Like the brand colors, a value under 3:1 on a chart background in one mode moves its lightness (OKLCH, same
   hue) just far enough there. */
export const UTR_METRIC_COLORS = {
	marketCap: [oldBlue, oldBlue],
	volume: ['#b58619', '#bb8c23'],
	depth: ['#9c27b0', '#a02cb4'],
	depthMarketCap: ['#3da142', '#4caf50'],
	/** Two-band stacks (CEX vs DEX, spot vs perps), first band then second. */
	volumeStack: [
		['#bd8200', '#db9700'],
		['#b58619', '#bb8c23']
	],
	depthStack: [
		['#0998cc', '#40c4ff'],
		[oldBlue, oldBlue]
	]
} as const

/** The equity sectors' colors, one per sector everywhere on the Equities pages (cards, treemap, rotation matrix). The
   palette holds ten colors and there are eleven sectors, so the eleventh takes sky: as far from its nearest palette
   color (teal) as the palette's own closest pair, and 3:1 on both chart backgrounds. */
export const SECTOR_COLORS: Record<string, string> = {
	technology: CHART_COLORS[0],
	'financial-services': CHART_COLORS[1],
	'consumer-cyclical': CHART_COLORS[2],
	healthcare: CHART_COLORS[3],
	'communication-services': CHART_COLORS[4],
	industrials: CHART_COLORS[5],
	'consumer-defensive': CHART_COLORS[6],
	energy: CHART_COLORS[7],
	'basic-materials': CHART_COLORS[8],
	utilities: CHART_COLORS[9],
	'real-estate': '#1a8fc4'
}
