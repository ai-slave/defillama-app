import type { ReactNode } from 'react'

/** Stat cells that share hairlines inside one surface: a readout row under a chart, a ledger strip of figures. Every
    cell gets a top and a left line; the grid sits one pixel up and left inside a clipping box, so the outer lines
    fall outside and only the lines between cells show, at any column count and breakpoint, and with a short last
    row. The host draws the outer border (a Card, a Panel, a ChartPanel body).

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
			<div className={`-mt-px -ml-px grid *:border-t *:border-l *:border-subtle ${columns}`}>{children}</div>
		</div>
	)
}
