import type { ReactNode } from 'react'

/** Stat cells that share hairlines inside one surface: a readout row under a chart, a ledger strip of figures. Every
    cell gets a bottom and a left line; the grid sits one pixel down and left inside a clipping box, so the outer lines
    fall outside and only the lines between cells show, at any column count and breakpoint. Bottom lines rather than
    top ones keep a short last row's divider full width: every cell above it draws its own line, where a top line
    would only span the cells in the short row. The host draws the outer border (a Card, a Panel, a ChartPanelBody).

    `columns` holds the grid's own classes, breakpoints included (`grid-cols-1 md:grid-cols-3`); cells keep their own
    padding and content. Separate cards in a row are StatTile (./SummaryStats.tsx), never this. */
export function DividedGrid({
	columns,
	className,
	children
}: {
	columns: string
	/** Placement only: margins, a grid area. */
	className?: string
	children: ReactNode
}) {
	return (
		<div className={`overflow-hidden ${className ?? ''}`.trim()}>
			<div className={`-mb-px -ml-px grid *:border-b *:border-l *:border-subtle ${columns}`}>{children}</div>
		</div>
	)
}
