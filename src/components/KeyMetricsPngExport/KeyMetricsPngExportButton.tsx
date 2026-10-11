import { useState, type RefObject } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { METRIC_LABEL_SELECTOR, METRIC_VALUE_SELECTOR } from '~/ui/MetricPrimitives'
import { BusyGlyph } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { downloadDataURL } from '~/utils/download'
interface KeyMetricsPngExportButtonProps {
	containerRef: RefObject<HTMLDivElement | null>
	/** Heading text and download filename stem. */
	title: string
	/** Same-origin icon URL drawn beside the title; omit to skip the icon. */
	iconUrl?: string
	/** Pass null when the card has no headline metric to show. */
	primaryValue: number | null
	primaryLabel: string
	formatPrice: (value: number) => string | number | null
}

interface MetricRow {
	label: string
	value: string
}

function getTrimmedText(el: Element | null | undefined): string {
	return el?.textContent?.trim().replace(/\s+/g, ' ') ?? ''
}

function extractLabel(el: Element): string {
	// Tooltip rows nest the label span inside the tooltip anchor, so search descendants
	// before falling back to a bare span (which would otherwise match the value).
	const label =
		el.querySelector?.(METRIC_LABEL_SELECTOR) ??
		Array.from(el.children).find((child) => child.tagName.toUpperCase() === 'SPAN')

	return getTrimmedText(label)
}

function extractValue(el: Element): string {
	const valueEl = el.querySelector?.(METRIC_VALUE_SELECTOR) ?? null
	return getTrimmedText(valueEl)
}

function extractRow(el: Element): MetricRow | null {
	const label = extractLabel(el)
	const value = extractValue(el)
	if (!label || !value) return null
	return { label, value }
}

export function extractRows(container: HTMLDivElement): Array<MetricRow> {
	const rows: Array<MetricRow> = []
	const children = Array.from(container.children)

	for (const child of children) {
		const tagName = child.tagName.toUpperCase()

		if (tagName === 'P') {
			const row = extractRow(child)
			if (row) rows.push(row)
		} else if (tagName === 'DETAILS') {
			const summary = child.querySelector('summary')
			if (summary) {
				const row = extractRow(summary)
				if (row) rows.push(row)
			}
		}
	}

	return rows
}

async function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.addEventListener('load', () => resolve(img), { once: true })
		img.addEventListener('error', reject, { once: true })
		img.src = src
	})
}

async function loadIconDataUrl(url: string): Promise<string | null> {
	try {
		const response = await fetch(url)
		if (!response.ok) return null
		const blob = await response.blob()
		return await new Promise<string | null>((resolve) => {
			const reader = new FileReader()
			// loadend fires after error and abort too, with a non-string result.
			reader.addEventListener('loadend', () => resolve(typeof reader.result === 'string' ? reader.result : null), {
				once: true
			})
			reader.readAsDataURL(blob)
		})
	} catch {
		return null
	}
}

function drawCircularImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
	ctx.closePath()
	ctx.clip()
	ctx.drawImage(img, x, y, size, size)
	ctx.restore()
}

function fillRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	ctx.beginPath()
	if (typeof ctx.roundRect === 'function') {
		ctx.roundRect(x, y, width, height, radius)
	} else {
		const r = Math.min(radius, width / 2, height / 2)
		ctx.moveTo(x + r, y)
		ctx.lineTo(x + width - r, y)
		ctx.quadraticCurveTo(x + width, y, x + width, y + r)
		ctx.lineTo(x + width, y + height - r)
		ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
		ctx.lineTo(x + r, y + height)
		ctx.quadraticCurveTo(x, y + height, x, y + height - r)
		ctx.lineTo(x, y + r)
		ctx.quadraticCurveTo(x, y, x + r, y)
	}
	ctx.closePath()
	ctx.fill()
}

export function KeyMetricsPngExportButton({
	containerRef,
	title,
	iconUrl,
	primaryValue,
	primaryLabel,
	formatPrice
}: KeyMetricsPngExportButtonProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [isDark] = useDarkModeManager()

	const handleExport = async () => {
		if (isLoading || !containerRef.current) return

		setIsLoading(true)

		const bgColor = isDark ? '#0b1214' : '#ffffff'
		const textColor = isDark ? '#ffffff' : '#000000'
		const labelColor = isDark ? '#d1d1d1' : '#666666'
		const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
		const watermarkSrc = isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp'

		const renderAndDownload = async () => {
			let formattedPrimaryValue = ''
			if (primaryValue != null) {
				const formatted = formatPrice(primaryValue)
				if (formatted != null) formattedPrimaryValue = String(formatted)
			}
			const hasPrimaryValue = formattedPrimaryValue !== ''
			const dpr = window.devicePixelRatio || 1
			const primaryValueHeight = hasPrimaryValue ? 72 : 0
			const container = containerRef.current
			if (!container) return
			const rows = extractRows(container)

			if (!hasPrimaryValue && rows.length === 0) return

			const containerWidth = container.getBoundingClientRect().width
			const canvasWidth = Math.max(400, Math.min(600, containerWidth))

			const padding = 24
			const headerHeight = 56
			const rowHeight = 32
			const rowsHeight = rows.length * rowHeight
			// Footer strip holds the corner watermark so it never overlaps a row.
			const footerHeight = 32
			const canvasHeight = padding * 2 + headerHeight + primaryValueHeight + rowsHeight + footerHeight

			const canvas = document.createElement('canvas')
			canvas.width = canvasWidth * dpr
			canvas.height = canvasHeight * dpr
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				return
			}

			ctx.scale(dpr, dpr)

			ctx.fillStyle = bgColor
			fillRoundedRect(ctx, 0, 0, canvasWidth, canvasHeight, 12)

			const iconBase64 = iconUrl ? await loadIconDataUrl(iconUrl) : null
			let iconImg: HTMLImageElement | null = null
			if (iconBase64) {
				try {
					iconImg = await loadImage(iconBase64)
				} catch {
					// A missing icon leaves the header without a logo.
				}
			}

			let headerX = padding
			const headerY = padding
			const iconSize = 40

			if (iconImg) {
				drawCircularImage(ctx, iconImg, headerX, headerY, iconSize)
				headerX += iconSize + 12
			}

			ctx.fillStyle = textColor
			ctx.font = 'bold 24px system-ui, -apple-system, sans-serif'
			ctx.textBaseline = 'middle'
			ctx.fillText(title, headerX, headerY + iconSize / 2)

			let rowsStartY = headerY + headerHeight

			if (hasPrimaryValue) {
				const primaryY = headerY + headerHeight
				ctx.fillStyle = labelColor
				ctx.font = '14px system-ui, -apple-system, sans-serif'
				ctx.textAlign = 'left'
				ctx.textBaseline = 'top'
				ctx.fillText(primaryLabel, padding, primaryY)

				ctx.fillStyle = textColor
				ctx.font = 'bold 32px "JetBrains Mono", monospace'
				ctx.fillText(formattedPrimaryValue, padding, primaryY + 22)

				rowsStartY = primaryY + primaryValueHeight
			}

			ctx.font = '14px system-ui, -apple-system, sans-serif'

			for (const [index, row] of rows.entries()) {
				const rowY = rowsStartY + index * rowHeight

				ctx.strokeStyle = borderColor
				ctx.lineWidth = 1
				ctx.beginPath()
				ctx.moveTo(padding, rowY)
				ctx.lineTo(canvasWidth - padding, rowY)
				ctx.stroke()

				ctx.fillStyle = labelColor
				ctx.textBaseline = 'middle'
				ctx.textAlign = 'left'
				ctx.fillText(row.label, padding, rowY + rowHeight / 2)

				ctx.fillStyle = textColor
				ctx.textAlign = 'right'
				ctx.font = '14px "JetBrains Mono", monospace'
				ctx.fillText(row.value, canvasWidth - padding, rowY + rowHeight / 2)

				ctx.font = '14px system-ui, -apple-system, sans-serif'
			}

			try {
				const watermarkImg = await loadImage(watermarkSrc)
				const wmHeight = 20
				const wmWidth = (watermarkImg.width / watermarkImg.height) * wmHeight
				const wmX = canvasWidth - padding - wmWidth
				const wmY = canvasHeight - padding - footerHeight + (footerHeight - wmHeight) / 2

				ctx.globalAlpha = 0.4
				ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight)
				ctx.globalAlpha = 1
			} catch {
				// The watermark is optional; the export still succeeds without it.
			}

			const dataUrl = canvas.toDataURL('image/png')
			const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-key-metrics`
			downloadDataURL(filename, dataUrl)
		}
		try {
			await renderAndDownload()
		} catch (error) {
			console.error('Error exporting key metrics:', error)
		}
		setIsLoading(false)
	}

	return (
		<Tooltip
			content="Download Key Metrics as PNG"
			render={
				<Button
					type="button"
					size="sm"
					onClick={() => {
						void handleExport()
					}}
					// No pendingLabel: it would reserve "Exporting…" and widen the button at rest; the icon turns into the spinner.
					pending={isLoading}
					aria-label="Download Key Metrics as PNG"
				/>
			}
		>
			{isLoading ? <BusyGlyph decorative size={12} /> : <Icon name="download-paper" className="size-3" />}
			<span>.png</span>
		</Tooltip>
	)
}
