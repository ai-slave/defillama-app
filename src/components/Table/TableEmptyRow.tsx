import type { ReactNode } from 'react'
import { NoResults } from '~/ui/NoResults'

/**
 * The full-width row a table renders under its headers when the row model is empty, so the toolbar, search and
 * headers stay on screen and the reader can change the query. The box sticks to the scroller's left edge and is as
 * wide as the table or, when the table scrolls wider than the screen, as the visible width, so its centered text
 * stays in view. A `translate` to center a sticky box pushed a wide message past the scroller's edge.
 */
export function TableEmptyRow({ colSpan, children }: { colSpan: number; children?: ReactNode }) {
	return (
		<tr>
			<td colSpan={colSpan} className="p-0">
				<div className="sticky left-0 w-[min(100%,calc(100vw-2rem))]">
					<NoResults>{children}</NoResults>
				</div>
			</td>
		</tr>
	)
}
