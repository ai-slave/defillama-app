import { color, graphic, type registerPostUpdate } from 'echarts/core'

type Rgb = [number, number, number]

function composite(background: Rgb, foreground: string, opacity: number): Rgb {
	const rgba = color.parse(foreground)!
	const alpha = rgba[3] * opacity
	return [
		rgba[0] * alpha + background[0] * (1 - alpha),
		rgba[1] * alpha + background[1] * (1 - alpha),
		rgba[2] * alpha + background[2] * (1 - alpha)
	]
}

export function getTreemapTextColor(background: Rgb): '#000' | '#fff' {
	const linear = background.map((channel) => {
		const srgb = channel / 255
		return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
	})
	const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
	return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000' : '#fff'
}

function contrastLabels(group: graphic.Group, background: Rgb) {
	// Each treemap group draws its border/header rectangle before its content and child groups.
	let backdrop = background
	for (const element of group.childrenRef()) {
		if (element instanceof graphic.Group) {
			contrastLabels(element, backdrop)
			continue
		}
		// Treemap palettes resolve to solid fills; images and gradient objects are not tile backgrounds.
		if (!(element instanceof graphic.Rect) || typeof element.style.fill !== 'string') continue
		backdrop = composite(backdrop, element.style.fill, element.style.opacity ?? 1)
		const text = element.getTextContent()
		if (!text) continue
		const labelBackground = text.style.backgroundColor
		const fill = getTreemapTextColor(
			typeof labelBackground === 'string' ? composite(backdrop, labelBackground, 1) : backdrop
		)
		const rich = { ...text.style.rich }
		for (const name in rich) {
			rich[name] = { ...rich[name], fill, stroke: 'transparent', lineWidth: 0, opacity: 1, textShadowBlur: 0 }
		}
		text.setStyle({ fill, stroke: 'transparent', lineWidth: 0, opacity: 1, textShadowBlur: 0, rich })
	}
}

// Run after ECharts resolves palette colors and creates native labels, including parent headers.
export function TreemapLabelContrast(registers: { registerPostUpdate: typeof registerPostUpdate }) {
	registers.registerPostUpdate((model, api) => {
		model.eachSeriesByType('treemap', (series) => {
			let background: Rgb = [255, 255, 255]
			const ancestors: Array<HTMLElement> = []
			for (let element: HTMLElement | null = api.getDom(); element; element = element.parentElement) {
				ancestors.push(element)
			}
			for (let i = ancestors.length - 1; i >= 0; i--) {
				const fill = getComputedStyle(ancestors[i]).backgroundColor
				if (fill) background = composite(background, fill, 1)
			}
			const canvasBackground = api.getZr().getBackgroundColor()
			if (typeof canvasBackground === 'string') background = composite(background, canvasBackground, 1)
			contrastLabels(api.getViewOfSeriesModel(series).group, background)
		})
	})
}
