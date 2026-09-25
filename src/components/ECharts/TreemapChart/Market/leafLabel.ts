// zrender lays text into cell minus 2x(border+padding) and drops whole lines
// that overflow the box; treemap's default padding of 5 blanks small cells.
export const LEAF_LABEL_PADDING = 1
export const LEAF_BORDER_WIDTH = 1
export const LABEL_BOX_PADDING = (LEAF_LABEL_PADDING + LEAF_BORDER_WIDTH) * 2

const FIT_SLACK = 3

export const lineHeightOf = (size: number) => size + 4
export const iconLineHeightOf = (size: number) => size + 2

const SCALE_BUCKETS = [
	{ icon: 48, ticker: 18, chg: 15 },
	{ icon: 36, ticker: 15, chg: 12 },
	{ icon: 26, ticker: 12, chg: 10 },
	{ icon: 20, ticker: 10, chg: 9 },
	{ icon: 16, ticker: 9, chg: 9 }
] as const

const ICON_ONLY_BUCKETS = [{ icon: 12 }, { icon: 8 }] as const

const TEXT_BUCKETS = SCALE_BUCKETS.map(({ ticker, chg }) => ({ ticker, chg }))

export const ICON_SIZES = [
	...new Set<number>([...SCALE_BUCKETS.map((b) => b.icon), ...ICON_ONLY_BUCKETS.map((b) => b.icon)])
]
export const TICKER_SIZES = [...new Set<number>(SCALE_BUCKETS.map((b) => b.ticker))]
export const CHG_SIZES = [...new Set<number>(SCALE_BUCKETS.map((b) => b.chg))]

const MIN_TEXT_WIDTH = 24

/** The largest icon/ticker/change layout that fits the cell; logos that failed to load fall back to text. */
export function pickLeafLabel(
	cellWidth: number,
	cellHeight: number,
	name: string,
	changeLabel: string,
	iconOk: boolean
): string {
	if (iconOk) {
		for (const bucket of SCALE_BUCKETS) {
			const fullHeight =
				iconLineHeightOf(bucket.icon) + lineHeightOf(bucket.ticker) + lineHeightOf(bucket.chg) + FIT_SLACK
			if (cellHeight >= fullHeight && cellWidth >= bucket.icon + 10) {
				return [`{icon${bucket.icon}|}`, `{ticker${bucket.ticker}|${name}}`, `{chg${bucket.chg}|${changeLabel}}`].join(
					'\n'
				)
			}
		}
		for (const bucket of SCALE_BUCKETS) {
			if (
				cellHeight >= iconLineHeightOf(bucket.icon) + lineHeightOf(bucket.chg) + FIT_SLACK &&
				cellWidth >= bucket.icon + 8
			) {
				return [`{icon${bucket.icon}|}`, `{chg${bucket.chg}|${changeLabel}}`].join('\n')
			}
		}
		for (const bucket of ICON_ONLY_BUCKETS) {
			if (cellWidth >= bucket.icon && cellHeight >= iconLineHeightOf(bucket.icon)) {
				return `{icon${bucket.icon}|}`
			}
		}
		return ''
	}
	for (const bucket of TEXT_BUCKETS) {
		if (
			cellHeight >= lineHeightOf(bucket.ticker) + lineHeightOf(bucket.chg) + FIT_SLACK &&
			cellWidth >= MIN_TEXT_WIDTH
		) {
			return [`{ticker${bucket.ticker}|${name}}`, `{chg${bucket.chg}|${changeLabel}}`].join('\n')
		}
	}
	for (const bucket of TEXT_BUCKETS) {
		if (cellHeight >= lineHeightOf(bucket.ticker) && cellWidth >= MIN_TEXT_WIDTH) {
			return `{ticker${bucket.ticker}|${name}}`
		}
	}
	return ''
}

const LABEL_LINE_HEIGHTS: Record<string, number> = {}
for (const fontSize of TICKER_SIZES) LABEL_LINE_HEIGHTS[`ticker${fontSize}`] = lineHeightOf(fontSize)
for (const fontSize of CHG_SIZES) LABEL_LINE_HEIGHTS[`chg${fontSize}`] = lineHeightOf(fontSize)
for (const iconSize of ICON_SIZES) LABEL_LINE_HEIGHTS[`icon${iconSize}`] = iconLineHeightOf(iconSize)

/**
 * Treemap pins a label box to the full cell, so a leaf label is centered by shifting it down by half the
 * height its lines leave free. Plain labels (group names) keep ECharts' placement.
 */
export function centerLeafLabel(text: string, cellHeight: number): { dy?: number } {
	if (!text.startsWith('{')) return {}
	let contentHeight = 0
	for (const line of text.split('\n')) {
		const marker = /^\{((?:icon|ticker|chg)\d+)/.exec(line)
		if (!marker) continue
		const lineHeight = LABEL_LINE_HEIGHTS[marker[1] ?? '']
		if (lineHeight !== undefined) contentHeight += lineHeight
	}
	return { dy: (cellHeight - contentHeight) / 2 - LEAF_LABEL_PADDING }
}
