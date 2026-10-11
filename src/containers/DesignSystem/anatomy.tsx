import { createContext, useState } from 'react'

/* The anatomy overlay. With Show anatomy on, a part's playground frame outlines the regions its demo marks and labels
   them, measured from the live DOM, so the drawing follows the part when the part changes. A region with padding
   also shows that padding as a tint, read from its computed style.

   A demo marks a region with data-anatomy="Label" on an element it already renders: through the part's own props
   where the part forwards unknown props (Button, Card, Panel, ChartPanelToolbar, ChartPanelBody, SegmentedControl,
   SearchField's input, Icon), or on a display:contents wrapper the demo owns where it does not (ChartPanelTitle,
   BusyGlyph, SearchField's icon and ×, EmptyState, KeyMetricsPanel). A wrapper has no box, so it draws nothing
   itself. INNER names the regions inside a marked part by selector; those selectors follow the part's markup, so a
   region that stops drawing here means the part's markup moved. */

export const AnatomyContext = createContext(false)

const INNER: Record<string, ReadonlyArray<[string, string]>> = {
	Button: [['Reserved width (pendingLabel)', '[data-label]']],
	SegmentedControl: [
		['Segment', ':scope > label:first-of-type'],
		['Radio spread over the segment', ':scope > label:first-of-type > input']
	],
	ChartPanelToolbar: [
		['Leading group', ':scope > div:first-child'],
		['Right-hand control', ':scope > :not(:first-child)']
	],
	ChartPanelTitle: [
		['Heading', 'h1, h2, h3, h4'],
		['Subtitle', 'p']
	],
	BusyGlyph: [
		['Decorative glyph', ':scope > [aria-hidden]'],
		['Spinner', ':scope > [role="status"] > :first-child'],
		['Label (joins the name)', ':scope > [role="status"] > :last-child']
	],
	SearchField: [
		['Search icon', ':scope > div > svg'],
		['Clear ×', ':scope > div > button']
	],
	EmptyState: [
		['EmptyState', ':scope > div'],
		['Disc', ':scope > div > span'],
		['Title', '[role="status"] > :first-child'],
		['Hint', '[role="status"] > p:nth-child(2)'],
		['Actions', '[role="status"] + div']
	],
	KeyMetricsPanel: [
		['Heading', 'h1, h2, h3, h4'],
		['Row', ':scope > div > div:nth-child(2) > *'],
		['Footer exports', ':scope > div > div:nth-child(3)']
	]
}

type Region = {
	label: string
	x: number
	y: number
	width: number
	height: number
	/** Top, right, bottom, left in px; null when the region has none. */
	padding: Array<number> | null
	labelX: number
	labelY: number
}

// label-xs is 10px type on a 12px line; the chip adds 1px above and below.
const LABEL_HEIGHT = 14

function measure(frame: HTMLElement): Array<Region> {
	const origin = frame.getBoundingClientRect()
	const left = origin.left + frame.clientLeft - frame.scrollLeft
	const top = origin.top + frame.clientTop - frame.scrollTop
	const regions: Array<Region> = []
	const add = (label: string, element: Element) => {
		const rect = element.getBoundingClientRect()
		// A display:contents wrapper and an sr-only label have no box to outline.
		if (rect.width < 2 && rect.height < 2) return
		const style = getComputedStyle(element)
		const padding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(parseFloat)
		regions.push({
			label,
			x: rect.left - left,
			y: rect.top - top,
			width: rect.width,
			height: rect.height,
			padding: padding.some((side) => side > 0) ? padding : null,
			labelX: 0,
			labelY: 0
		})
	}
	for (const host of frame.querySelectorAll<HTMLElement>('[data-anatomy]')) {
		const label = host.dataset.anatomy
		add(label, host)
		for (const [inner, selector] of INNER[label] ?? []) {
			for (const element of host.querySelectorAll(selector)) add(inner, element)
		}
	}
	// Each label goes above its region, else inside its top edge, else below it, else higher up, at the first spot no
	// earlier label holds; labels stay inside the frame's scroll box, so they never add a scrollbar.
	const placed: Array<{ x: number; y: number; width: number }> = []
	for (const region of regions) {
		// Estimated from the text, so labels are placed before they render; a few pixels off only nudges where two meet.
		const width = region.label.length * 5.5 + 8
		const x = Math.max(0, Math.min(region.x, frame.scrollWidth - width))
		const free = (y: number) =>
			y >= 0 &&
			y + LABEL_HEIGHT <= frame.scrollHeight &&
			!placed.some(
				(label) =>
					label.x < x + width && x < label.x + label.width && label.y < y + LABEL_HEIGHT && y < label.y + LABEL_HEIGHT
			)
		const above = region.y - LABEL_HEIGHT
		const y =
			[above, region.y, region.y + region.height, above - LABEL_HEIGHT, above - 2 * LABEL_HEIGHT].find(free) ??
			Math.max(0, above)
		placed.push({ x, y, width })
		region.labelX = x
		region.labelY = y
	}
	return regions
}

/** The overlay for one playground frame: it measures the marked regions in its parent and redraws when the frame or a
    marked part changes size or the demo's markup changes (a × that appears, a label that swaps). */
export function AnatomyLayer() {
	const [regions, setRegions] = useState<Array<Region>>([])
	return (
		<div
			aria-hidden
			ref={(layer) => {
				// A frame without marks gets no observers; React then detaches the ref by calling it with null.
				if (!layer || !layer.parentElement.querySelector('[data-anatomy]')) return
				const frame = layer.parentElement
				const update = () => setRegions(measure(frame))
				// Observing measures once straight away, so the first drawing needs no separate call.
				const resize = new ResizeObserver(update)
				resize.observe(frame)
				for (const host of frame.querySelectorAll('[data-anatomy]')) resize.observe(host)
				// The layer's own redraw is a mutation inside the frame too; skip it, or every drawing triggers the next.
				const mutation = new MutationObserver((records) => {
					if (records.every((record) => layer.contains(record.target))) return
					update()
				})
				mutation.observe(frame, { childList: true, subtree: true, characterData: true })
				return () => {
					resize.disconnect()
					mutation.disconnect()
				}
			}}
			className="pointer-events-none absolute top-0 left-0 z-20"
		>
			{regions.map((region, index) => (
				// oxlint-disable-next-line react/no-array-index-key -- Every measurement replaces the whole list.
				<div key={index}>
					{region.padding ? (
						<div
							className="absolute border-solid border-(--bg-brand-tint) opacity-80"
							style={{
								left: region.x,
								top: region.y,
								width: region.width,
								height: region.height,
								borderWidth: region.padding.map((side) => `${side}px`).join(' ')
							}}
						/>
					) : null}
					<div
						className="absolute border border-dashed border-brand"
						style={{ left: region.x, top: region.y, width: region.width, height: region.height }}
					/>
					<span
						className="absolute z-10 rounded-sm bg-brand px-1 py-px label-xs whitespace-nowrap text-on-brand"
						style={{ left: region.labelX, top: region.labelY }}
					>
						{region.label}
					</span>
				</div>
			))}
		</div>
	)
}
