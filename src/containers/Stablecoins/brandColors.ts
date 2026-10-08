import { OTHERS_COLOR } from '~/constants/colors'

/**
 * Stablecoin brand colours by symbol (and by name, which Pro dashboard series use), kept over the palette because readers know them. Each is [light, dark]: a brand
 * under 3:1 on a chart background in one mode moves its lightness (OKLCH, same hue) just far enough there, and a brand
 * that passes keeps its hex in both. The chart payloads are cached for every reader, so they colour series by rank and
 * each chart swaps in the brand colour for its theme.
 */
const STABLECOIN_BRAND_COLORS: Record<string, readonly [light: string, dark: string]> = {
	USDT: ['#009393', '#009393'],
	USDC: ['#2775CA', '#2775CA'],
	DAI: ['#b98701', '#F4B731'],
	USDe: ['#3A3A3A', '#626262'],
	BUIDL: ['#111111', '#7a7a7a'],
	USD1: ['#a78a64', '#D2B48C'],
	USDS: ['#16a091', '#1BAB9B'],
	PYUSD: ['#0070E0', '#0070E0'],
	USDTB: ['#8f8f8f', '#C0C0C0'],
	FDUSD: ['#09a373', '#00D395'],
	Tether: ['#009393', '#009393'],
	'USD Coin': ['#2775CA', '#2775CA'],
	Dai: ['#b98701', '#F4B731'],
	'Ethena USDe': ['#3A3A3A', '#626262'],
	'Sky Dollar': ['#16a091', '#1BAB9B'],
	'PayPal USD': ['#0070E0', '#0070E0'],
	// Pie presentations give the remainder slice a palette colour; here it stays the neutral remainder.
	Others: [OTHERS_COLOR, OTHERS_COLOR]
}

const BRAND_COLORS_BY_THEME: [Record<string, string>, Record<string, string>] = [{}, {}]
for (const symbol in STABLECOIN_BRAND_COLORS) {
	BRAND_COLORS_BY_THEME[0][symbol] = STABLECOIN_BRAND_COLORS[symbol][0]
	BRAND_COLORS_BY_THEME[1][symbol] = STABLECOIN_BRAND_COLORS[symbol][1]
}

/** Brand colours for the chart's theme, keyed by symbol; a series or slice missing here keeps its rank colour. */
export function stablecoinBrandColors(isDark: boolean): Record<string, string> {
	return BRAND_COLORS_BY_THEME[isDark ? 1 : 0]
}
