export const oldBlue = '#1f67d2'

export const purple = '#9333ea' // Purple color for negative values

/* Chart series colours: the one categorical palette (design.md → Charts). Ten colours, each at 3:1 or more on the
   white card, light page, dark card and dark page, so one list serves both modes and PNG exports. Found by search
   in OKLCH for the widest separation between any two colours for normal and red–green colour-blind vision, and
   ordered so neighbours differ most, because series take colours by rank. Brand blue stays first for
   single-series charts. Brand colours that come with the data (stablecoins, partner dashboards) are kept. */
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

/** Past this many series a chart folds the rest into one "Others" series: more colours than this cannot be told apart. */
export const CHART_SERIES_LIMIT = 10

/** The "Others" series: a neutral grey at 3:1 or more on every chart background, so it reads as the remainder. */
export const OTHERS_COLOR = '#8a8d8f'

/** The colour for the series at this rank. Callers fold past CHART_SERIES_LIMIT, so the cycle is only a fallback. */
export function chartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length] ?? oldBlue
}

/** Colours for `count` series in rank order. */
export function chartColors(count: number): Array<string> {
	return Array.from({ length: count }, (_, index) => chartColor(index))
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** Treemap children: lighter steps of the parent's colour in OKLab, so siblings read as one family in both modes. */
export function childColors(parent: string, count: number): Array<string> {
	const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(parent.slice(i, i + 2), 16) / 255))
	const l0 = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m0 = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s0 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	const L = 0.2104542553 * l0 + 0.793617785 * m0 - 0.0040720468 * s0
	const A = 1.9779984951 * l0 - 2.428592205 * m0 + 0.4505937099 * s0
	const B = 0.0259040371 * l0 + 0.7827717662 * m0 - 0.808675766 * s0
	return Array.from({ length: count }, (_, index) => {
		if (index === 0) return parent
		const t = index / count
		const [l, a, bb] = [Math.min(0.92, L + 0.22 * t), A * (1 - 0.45 * t), B * (1 - 0.45 * t)]
		const l_ = (l + 0.3963377774 * a + 0.2158037573 * bb) ** 3
		const m_ = (l - 0.1055613458 * a - 0.0638541728 * bb) ** 3
		const s_ = (l - 0.0894841775 * a - 1.291485548 * bb) ** 3
		const rgb = [
			4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
			-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
			-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
		]
		return `#${rgb
			.map((v) =>
				Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')}`
	})
}
