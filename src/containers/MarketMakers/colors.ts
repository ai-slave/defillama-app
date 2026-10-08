export function percentileOpacity(p: number | null | undefined): number {
	if (p == null) return 0
	const band = Math.floor(p / 10) * 10
	if (band < 10) return 0
	if (band >= 100) return 100
	if (band >= 90) return 90
	if (band >= 80) return 80
	if (band >= 50) return 50
	return band
}

export function rankOpacity(r: number | null | undefined): number {
	if (r == null) return 0
	return Math.max(0, (6 - r) * 20)
}

// A HEAT_UP (emerald-9, rgb 0 123 69) wash keyed by intensity band: a higher rank or percentile is a better
// value. One rgba over the card background so it adapts to both themes on its own and reads as a gentle tint
// rather than a bold block; text inherits the theme colour. Static class literals so Tailwind compiles them,
// which is why the constant is spelled out here.
const HEAT_CLASS: Record<number, string> = {
	10: 'bg-[rgba(0,123,69,0.05)]',
	20: 'bg-[rgba(0,123,69,0.09)]',
	30: 'bg-[rgba(0,123,69,0.14)]',
	40: 'bg-[rgba(0,123,69,0.18)]',
	50: 'bg-[rgba(0,123,69,0.22)]',
	60: 'bg-[rgba(0,123,69,0.27)]',
	80: 'bg-[rgba(0,123,69,0.36)]',
	90: 'bg-[rgba(0,123,69,0.4)]',
	100: 'bg-[rgba(0,123,69,0.45)]'
}

// The fill paints under the 1px row divider (default border-box), so the
// semi-transparent divider composites over the translucent heatmap and the bottom
// border reads as tinted by the cell's heatmap.
export function heatmapClass(opacity: number): string | undefined {
	return HEAT_CLASS[opacity]
}
