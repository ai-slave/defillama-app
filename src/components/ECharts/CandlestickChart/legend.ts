import type { ICandlestickChartProps } from './types'

type Indicator = NonNullable<ICandlestickChartProps['indicators']>[number]

/**
 * One legend item per toggleable line. Bollinger upper/lower series shape the band but are controlled by the
 * middle-series item, so an overlay contributes only its own name; MACD and stochastic panels expand to
 * their component lines.
 */
export function candlestickLegendData(overlays: Array<Indicator>, panels: Array<Indicator>): Array<string> {
	const legendData = ['Volume']
	for (const overlay of overlays) legendData.push(overlay.name)
	for (const panel of panels) {
		const panelName = panel.name.toLowerCase()
		if (panel.values && panelName.includes('macd')) legendData.push('MACD', 'Signal', 'MACD Line')
		else if (panel.values && panelName.includes('stoch')) legendData.push('%K', '%D')
		else legendData.push(panel.name)
	}
	return legendData
}
