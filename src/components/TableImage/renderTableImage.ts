export type TableImageInput = {
	rows: Array<Array<string>>
	columnWidths?: Array<number | null>
	title?: string
	isDark: boolean
	scale?: number
	watermark?: boolean
}

type Palette = {
	page: string
	surface: string
	headerSurface: string
	text: string
	secondary: string
	border: string
	watermark: string
}

const LIGHT: Palette = {
	page: '#ffffff',
	surface: '#ffffff',
	headerSurface: '#eeeeee',
	text: '#090b0c',
	secondary: '#484848',
	border: 'rgba(9, 11, 12, 0.12)',
	watermark: '/assets/defillama-dark-neutral.webp'
}

const DARK: Palette = {
	page: '#090b0c',
	surface: '#131516',
	headerSurface: '#181a1b',
	text: '#ffffff',
	secondary: '#c6c6c6',
	border: 'rgba(255, 255, 255, 0.12)',
	watermark: '/assets/defillama-light-neutral.webp'
}

const FONT_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
const FONT_SIZE = 14
const LINE_HEIGHT = 20
const CELL_PAD_X = 16
const CELL_PAD_Y = 12
const OUTER_PAD = 24
const TITLE_SIZE = 18
const TITLE_GAP = 18
const FOOTER_SIZE = 11
const FOOTER_GAP = 14
const MIN_COL = 96
const MAX_COL = 420
const MAX_TABLE = 1600

// The logo's native aspect ratio, matching buildWatermarkGraphic in ECharts/shared.
const LOGO_RATIO = 389 / 133
const WATERMARK_OPACITY = 0.3

const NUMERIC = /^[-+]?[$€£¥]?\s?-?[\d,.]+\s?[%KMBTkmbt]?\+?$/

function isNumericColumn(rows: Array<Array<string>>, col: number): boolean {
	let seen = 0
	for (let r = 1; r < rows.length; r++) {
		const value = rows[r]?.[col]?.trim()
		if (!value) continue
		seen++
		if (!NUMERIC.test(value)) return false
	}
	return seen > 0
}

function wrapCell(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): Array<string> {
	if (!text) return ['']
	const words = text.split(/\s+/)
	const lines: Array<string> = []
	let line = ''

	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (ctx.measureText(candidate).width <= maxWidth || !line) {
			line = candidate
			continue
		}
		lines.push(line)
		line = word
	}
	if (line) lines.push(line)
	return lines.length > 0 ? lines : ['']
}

function resolveColumnWidths(
	ctx: CanvasRenderingContext2D,
	rows: Array<Array<string>>,
	columnCount: number,
	stored?: Array<number | null>
): Array<number> {
	const natural: Array<number> = []
	for (let c = 0; c < columnCount; c++) {
		let widest = 0
		for (let r = 0; r < rows.length; r++) {
			ctx.font = `${r === 0 ? '600 ' : ''}${FONT_SIZE}px ${FONT_STACK}`
			widest = Math.max(widest, ctx.measureText(rows[r]?.[c] ?? '').width)
		}
		natural.push(Math.min(MAX_COL, Math.max(MIN_COL, Math.ceil(widest) + CELL_PAD_X * 2)))
	}

	const resolved = natural.map((fallback, index) => {
		const width = stored?.[index]
		return typeof width === 'number' && Number.isFinite(width) && width > 0
			? Math.max(MIN_COL, Math.round(width))
			: fallback
	})

	const total = resolved.reduce((sum, width) => sum + width, 0)
	if (total <= MAX_TABLE) return resolved

	const factor = MAX_TABLE / total
	return resolved.map((width) => Math.max(MIN_COL, Math.floor(width * factor)))
}

function loadWatermark(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const image = new Image()
		image.addEventListener('load', () => resolve(image), { once: true })
		image.addEventListener('error', () => resolve(null), { once: true })
		image.src = src
	})
}

export async function renderTableImage(input: TableImageInput): Promise<Blob> {
	const rows = input.rows.filter((row) => row.length > 0)
	if (rows.length === 0) throw new Error('Table has no rows')

	const palette = input.isDark ? DARK : LIGHT
	const scale = input.scale ?? 2
	let columnCount = 0
	for (const row of rows) columnCount = Math.max(columnCount, row.length)
	const normalized = rows.map((row) => Array.from({ length: columnCount }, (_, i) => row[i] ?? ''))

	const measureCanvas = document.createElement('canvas')
	const measureCtx = measureCanvas.getContext('2d')
	if (!measureCtx) throw new Error('Canvas is not available')

	const columnWidths = resolveColumnWidths(measureCtx, normalized, columnCount, input.columnWidths)
	const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)

	const wrapped = normalized.map((row, rowIndex) =>
		row.map((cell, colIndex) => {
			measureCtx.font = `${rowIndex === 0 ? '600 ' : ''}${FONT_SIZE}px ${FONT_STACK}`
			return wrapCell(measureCtx, cell, columnWidths[colIndex] - CELL_PAD_X * 2)
		})
	)
	const rowHeights = wrapped.map((row) => {
		let lines = 1
		for (const cell of row) lines = Math.max(lines, cell.length)
		return lines * LINE_HEIGHT + CELL_PAD_Y * 2
	})

	const title = input.title?.trim()
	const titleBlock = title ? TITLE_SIZE + TITLE_GAP : 0
	const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0)
	const footerBlock = FOOTER_SIZE + FOOTER_GAP
	const width = tableWidth + OUTER_PAD * 2
	const height = titleBlock + tableHeight + footerBlock + OUTER_PAD * 2

	const canvas = document.createElement('canvas')
	canvas.width = Math.ceil(width * scale)
	canvas.height = Math.ceil(height * scale)
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas is not available')
	ctx.scale(scale, scale)
	ctx.textBaseline = 'top'

	ctx.fillStyle = palette.page
	ctx.fillRect(0, 0, width, height)

	let y = OUTER_PAD
	if (title) {
		ctx.fillStyle = palette.text
		ctx.font = `600 ${TITLE_SIZE}px ${FONT_STACK}`
		ctx.textAlign = 'left'
		ctx.fillText(title, OUTER_PAD, y)
		y += titleBlock
	}

	const tableTop = y
	ctx.fillStyle = palette.surface
	ctx.fillRect(OUTER_PAD, tableTop, tableWidth, tableHeight)
	ctx.fillStyle = palette.headerSurface
	ctx.fillRect(OUTER_PAD, tableTop, tableWidth, rowHeights[0])

	// Drawn under the text so the rows stay legible, sized from the table so it
	// keeps its visual weight at any export width.
	const watermark = input.watermark === false ? null : await loadWatermark(palette.watermark)
	if (watermark) {
		const logoWidth = Math.min(tableWidth * 0.18, 200)
		const logoHeight = logoWidth / LOGO_RATIO
		ctx.save()
		ctx.globalAlpha = WATERMARK_OPACITY
		ctx.drawImage(
			watermark,
			OUTER_PAD + (tableWidth - logoWidth) / 2,
			tableTop + (tableHeight - logoHeight) / 2,
			logoWidth,
			logoHeight
		)
		ctx.restore()
	}

	const alignRight = Array.from({ length: columnCount }, (_, c) => isNumericColumn(normalized, c))

	let rowTop = tableTop
	for (let r = 0; r < normalized.length; r++) {
		let x = OUTER_PAD
		for (let c = 0; c < columnCount; c++) {
			const lines = wrapped[r][c]
			ctx.font = `${r === 0 ? '600 ' : ''}${FONT_SIZE}px ${FONT_STACK}`
			ctx.fillStyle = r === 0 ? palette.text : palette.secondary
			ctx.textAlign = alignRight[c] ? 'right' : 'left'
			const textX = alignRight[c] ? x + columnWidths[c] - CELL_PAD_X : x + CELL_PAD_X
			for (let l = 0; l < lines.length; l++) {
				ctx.fillText(lines[l], textX, rowTop + CELL_PAD_Y + l * LINE_HEIGHT)
			}
			x += columnWidths[c]
		}
		rowTop += rowHeights[r]
	}

	ctx.strokeStyle = palette.border
	ctx.lineWidth = 1
	let lineY = tableTop
	for (let r = 0; r <= normalized.length; r++) {
		ctx.beginPath()
		ctx.moveTo(OUTER_PAD, Math.round(lineY) + 0.5)
		ctx.lineTo(OUTER_PAD + tableWidth, Math.round(lineY) + 0.5)
		ctx.stroke()
		lineY += rowHeights[r] ?? 0
	}
	let lineX = OUTER_PAD
	for (let c = 0; c <= columnCount; c++) {
		ctx.beginPath()
		ctx.moveTo(Math.round(lineX) + 0.5, tableTop)
		ctx.lineTo(Math.round(lineX) + 0.5, tableTop + tableHeight)
		ctx.stroke()
		lineX += columnWidths[c] ?? 0
	}

	ctx.fillStyle = palette.secondary
	ctx.font = `${FOOTER_SIZE}px ${FONT_STACK}`
	ctx.textAlign = 'left'
	ctx.fillText('defillama.com', OUTER_PAD, tableTop + tableHeight + FOOTER_GAP)
	ctx.textAlign = 'right'
	ctx.fillText(new Date().toISOString().slice(0, 10), OUTER_PAD + tableWidth, tableTop + tableHeight + FOOTER_GAP)

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob)
			else reject(new Error("Couldn't create the image."))
		}, 'image/png')
	})
}

export function tableImageFilename(title?: string): string {
	const base = title
		?.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
	const stamp = new Date().toISOString().slice(0, 10)
	return `${base || 'table'}-${stamp}.png`
}

export async function downloadTableImage(input: TableImageInput): Promise<void> {
	const blob = await renderTableImage(input)
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = tableImageFilename(input.title)
	document.body.appendChild(link)
	link.click()
	link.remove()
	// Revoking in the same tick can cancel the download in Firefox and Safari.
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function copyTableImage(input: TableImageInput): Promise<void> {
	const blob = await renderTableImage(input)
	if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
		throw new Error('Clipboard images are not supported in this browser')
	}
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
