/** Below this many rows on screen the 40px logo would sit over most of them, so a short table shows none. */
const MIN_ROWS = 8

/**
 * DefiLlama logo behind a table's rows. Render it as the scroller's first child and give the table
 * `position: relative`, so the rows paint over it and the cell text stays sharp. Body cells stay transparent and
 * the scroller carries the surface fill: an opaque cell background hides the logo. It counts the rows on screen now:
 * a search, filter or last page that leaves fewer than 8 rows hides it, and the table image export stamps its own
 * logo either way. 40px matches the chart logo's cap.
 *
 * It sticks to the middle of the table's first screen: the scroller only scrolls sideways, so a long table that
 * scrolls the page shows the logo near its top only, and a screenshot from far down the list has none.
 */
export function TableWatermark({ rowCount }: { rowCount: number }) {
	if (rowCount < MIN_ROWS) return null
	return (
		<div
			className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden"
			style={{ top: 'min(50%, 50vh)' }}
			aria-hidden="true"
		>
			<img
				src="/assets/defillama-dark-neutral.webp"
				alt=""
				height={40}
				width={117}
				className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
			/>
			<img
				src="/assets/defillama-light-neutral.webp"
				alt=""
				height={40}
				width={117}
				className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
			/>
		</div>
	)
}
