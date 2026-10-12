import { useCallback, useRef, type ReactNode } from 'react'
import { TableWatermark } from '~/components/Table/TableWatermark'
import {
	headingAbove,
	readColumnWidths,
	readTableRows,
	TableImageButtons
} from '~/components/TableImage/TableImageButtons'

// The export control is hidden until hover so a research page stays a reading
// surface. Coarse pointers have no hover, so it stays visible there.
const CONTROL_CLASS =
	'flex items-center justify-center gap-1 rounded-md px-2 py-1 label-xs tracking-wider text-secondary uppercase transition-colors not-disabled:hover:bg-hover-row not-disabled:hover:text-primary focus-visible:bg-hover-row disabled:text-disabled'

export function ArticleTableFrame({ children, rowCount }: { children: ReactNode; rowCount: number }) {
	const wrapRef = useRef<HTMLDivElement>(null)

	const getSource = useCallback(() => {
		const table = wrapRef.current?.querySelector('table') ?? null
		const rows = readTableRows(table)
		if (rows.length === 0) return null
		return { rows, columnWidths: readColumnWidths(table), title: headingAbove(table) }
	}, [])

	return (
		<div className="group relative mt-9 mb-6">
			<div className="pointer-events-none absolute -top-8 right-0 z-20 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
				<div className="pointer-events-auto">
					<TableImageButtons
						getSource={getSource}
						trigger={<button type="button" className={CONTROL_CLASS} />}
						triggerLabel="Export"
					/>
				</div>
			</div>
			<div ref={wrapRef} className="article-table-wrap not-prose relative overflow-x-auto">
				<TableWatermark rowCount={rowCount} />
				{children}
			</div>
		</div>
	)
}
