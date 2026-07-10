import { useMemo } from 'react'

/**
 * Chart chrome colors (axis labels, gridlines, dataZoom, PNG-export framing),
 * resolved from the --chart-* CSS custom properties in
 * src/styles/semantics.css. ECharts renders to canvas and cannot read var()
 * directly, so values are resolved via getComputedStyle at call time and
 * re-resolved when the theme flips.
 *
 * Series colors are NOT part of this: they come from CHART_COLORS /
 * getNDistinctColors and are intentionally not theme tokens.
 *
 * The fallbacks below are the exact literals the chart configs used before
 * tokenization — if a token is missing or this runs before the stylesheet
 * loads (SSR), rendering stays byte-identical to the pre-token behavior.
 */
export interface ChartTheme {
	text: string
	/** Axis tick labels — tertiary gray, quieter than `text` (titles/legend). */
	axisLabel: string
	legendPageActive: string
	legendPageInactive: string
	/** Chart accents (candles, up/down fills) — fixed across modes per the library. */
	up: string
	down: string
	gridline: string
	areaGradientTo: string
	zoomBorder: string
	zoomHandleBorder: string
	zoomHandleFill: string
	zoomEmphasisBorder: string
	zoomEmphasisMoveFill: string
	zoomFiller: string
	exportBg: string
	exportText: string
	exportTextMuted: string
	exportLegendText: string
	exportLegendInactive: string
	logoBg: string
	exportLabelStroke: string
	treemapLabel: string
	/** Monochrome chrome at an alpha: black in light mode, white in dark. */
	ink: (alpha: number) => string
	/** Page-toned chrome at an alpha: white in light mode, black in dark. */
	inkInverted: (alpha: number) => string
}

const TOKENS: Record<
	Exclude<keyof ChartTheme, 'ink' | 'inkInverted'>,
	{ cssVar: string; light: string; dark: string }
> = {
	text: { cssVar: '--chart-text', light: 'rgba(0, 0, 0, 1)', dark: 'rgba(255, 255, 255, 1)' },
	axisLabel: { cssVar: '--chart-axis-label', light: '#6f6f6f', dark: '#878787' },
	legendPageActive: { cssVar: '--chart-legend-page-active', light: '#1f67d2', dark: '#1f67d2' },
	legendPageInactive: {
		cssVar: '--chart-legend-page-inactive',
		light: '#6f6f6f80',
		dark: '#87878780'
	},
	up: { cssVar: '--chart-up', light: '#3eb84f', dark: '#3eb84f' },
	down: { cssVar: '--chart-down', light: '#e24a42', dark: '#e24a42' },
	gridline: { cssVar: '--chart-gridline', light: 'rgba(0, 0, 0, 0.03)', dark: 'rgba(255, 255, 255, 0.02)' },
	areaGradientTo: {
		cssVar: '--chart-area-gradient-to',
		light: 'rgba(255, 255, 255, 0.2)',
		dark: 'rgba(0, 0, 0, 0.2)'
	},
	zoomBorder: { cssVar: '--chart-zoom-border', light: 'rgba(0, 0, 0, 0.4)', dark: 'rgba(255, 255, 255, 0.4)' },
	zoomHandleBorder: {
		cssVar: '--chart-zoom-handle-border',
		light: 'rgba(0, 0, 0, 0.9)',
		dark: 'rgba(255, 255, 255, 0.9)'
	},
	zoomHandleFill: {
		cssVar: '--chart-zoom-handle-fill',
		light: 'rgba(255, 255, 255, 0.4)',
		dark: 'rgba(0, 0, 0, 0.4)'
	},
	zoomEmphasisBorder: {
		cssVar: '--chart-zoom-emphasis-border',
		light: '#000',
		dark: 'rgba(255, 255, 255, 1)'
	},
	zoomEmphasisMoveFill: {
		cssVar: '--chart-zoom-emphasis-move-fill',
		light: 'rgba(0, 0, 0, 0.2)',
		dark: 'rgba(255, 255, 255, 0.2)'
	},
	zoomFiller: { cssVar: '--chart-zoom-filler', light: 'rgba(255, 255, 255, 0.1)', dark: 'rgba(0, 0, 0, 0.1)' },
	exportBg: { cssVar: '--chart-export-bg', light: '#ffffff', dark: '#0b1214' },
	exportText: { cssVar: '--chart-export-text', light: '#000000', dark: '#ffffff' },
	exportTextMuted: {
		cssVar: '--chart-export-text-muted',
		light: 'rgba(0, 0, 0, 0.8)',
		dark: 'rgba(255, 255, 255, 0.8)'
	},
	exportLegendText: {
		cssVar: '--chart-export-legend-text',
		light: 'rgba(0, 0, 0, 0.9)',
		dark: 'rgba(255, 255, 255, 0.9)'
	},
	exportLegendInactive: {
		cssVar: '--chart-export-legend-inactive',
		light: 'rgba(0, 0, 0, 0.5)',
		dark: 'rgba(255, 255, 255, 0.5)'
	},
	logoBg: { cssVar: '--chart-logo-bg', light: '#ffffff', dark: '#1a1a1a' },
	exportLabelStroke: {
		cssVar: '--chart-export-label-stroke',
		light: 'rgba(0, 0, 0, 0.45)',
		dark: 'rgba(0, 0, 0, 0.7)'
	},
	treemapLabel: { cssVar: '--chart-treemap-label', light: '#111', dark: '#fff' }
}

export function getChartTheme(isThemeDark: boolean): ChartTheme {
	// On a theme toggle React re-renders with the new isThemeDark BEFORE the
	// effect in useDarkModeManager flips the html class, so getComputedStyle
	// would read the outgoing mode. Only trust the DOM when it agrees with
	// isThemeDark; otherwise use the fallbacks (identical values by
	// construction).
	const domAgrees =
		typeof document !== 'undefined' && document.documentElement.classList.contains('dark') === isThemeDark
	const styles = domAgrees ? getComputedStyle(document.documentElement) : null
	const theme = {} as ChartTheme
	for (const key in TOKENS) {
		const { cssVar, light, dark } = TOKENS[key as keyof typeof TOKENS]
		const resolved = styles?.getPropertyValue(cssVar).trim()
		theme[key as keyof typeof TOKENS] = resolved || (isThemeDark ? dark : light)
	}
	// Per-chart monochrome chrome (labels, faint fills, shadows) uses ad-hoc
	// alphas that are chart tuning, not design tokens — Figma has no
	// equivalents. One helper instead of scattered literals.
	theme.ink = (alpha) => (isThemeDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`)
	theme.inkInverted = (alpha) => (isThemeDark ? `rgba(0, 0, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`)
	return theme
}

export function useChartTheme(isThemeDark: boolean): ChartTheme {
	return useMemo(() => getChartTheme(isThemeDark), [isThemeDark])
}
