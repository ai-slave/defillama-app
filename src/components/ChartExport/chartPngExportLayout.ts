export const IMAGE_EXPORT_WIDTH = 1280
export const EXPORT_FONT_SIZE = 24
export const LEGEND_ITEM_GAP = 20
export const BASE_TOP_PADDING = 16

const LEGEND_ITEM_WIDTH = 48

const approximateTextWidth = (text: string, fontSize: number) => {
	if (!text) return 0
	return text.length * fontSize * 0.6
}

export interface ExportLayout {
	gridTop: number
	legendTop: number
	canShareRow: boolean
	hasLegend: boolean
	legendRows: number
	totalLegendWidth: number
}

export function computeExportLayout(opts: {
	title: string | undefined
	legendItems: string[]
	shouldShowLegend: boolean
	hasIcon: boolean
	expandLegend: boolean | undefined
}): ExportLayout {
	const { title, legendItems, shouldShowLegend, hasIcon, expandLegend } = opts

	const totalLegendWidth = legendItems.reduce(
		(total, name) => total + approximateTextWidth(name, EXPORT_FONT_SIZE) + LEGEND_ITEM_WIDTH + LEGEND_ITEM_GAP,
		0
	)

	const hasLegend = shouldShowLegend && legendItems.length > 0
	const availableWidth = IMAGE_EXPORT_WIDTH - 32
	let legendRows = 1
	if (expandLegend) {
		legendRows = Math.max(1, Math.ceil(totalLegendWidth / availableWidth))
	}

	const titleHeight = title ? 36 : 0
	const singleRowHeight = 32
	const legendHeight = hasLegend ? singleRowHeight * legendRows : 0
	const verticalGap = 16
	const titleWidth = title ? approximateTextWidth(title, 28) + (hasIcon ? 40 : 0) : 0
	const horizontalGap = 24
	const canShareRow =
		!!title &&
		hasLegend &&
		legendRows === 1 &&
		totalLegendWidth > 0 &&
		titleWidth + horizontalGap + totalLegendWidth <= availableWidth

	const legendTop =
		BASE_TOP_PADDING +
		(canShareRow ? Math.max(0, (titleHeight - singleRowHeight) / 2) : title ? titleHeight + verticalGap : 0)
	const gridTop =
		BASE_TOP_PADDING +
		(canShareRow
			? Math.max(titleHeight, legendHeight) + verticalGap
			: (title ? titleHeight + verticalGap : 0) +
				(hasLegend ? legendHeight + verticalGap + (expandLegend ? 16 : 0) : 0))

	return { gridTop, legendTop, canShareRow, hasLegend, legendRows, totalLegendWidth }
}
