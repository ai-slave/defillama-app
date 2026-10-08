import { useCallback, useRef, type ReactNode } from 'react'
import {
	headingAbove,
	readColumnWidths,
	readTableRows,
	TableImageButtons
} from '~/components/TableImage/TableImageButtons'

const WATERMARK_HEIGHT = 40
const WATERMARK_WIDTH = Math.round((389 / 133) * WATERMARK_HEIGHT)

// The export control is hidden until hover so a research page stays a reading
// surface. Coarse pointers have no hover, so it stays visible there.
const CONTROL_CLASS =
	'flex items-center justify-center gap-1 rounded-md px-2 py-1 label-xs tracking-wider text-tertiary uppercase transition-colors hover:bg-research-tint-hover hover:text-primary focus-visible:bg-research-tint-hover disabled:opacity-50'

export function ArticleTableFrame({ children }: { children: ReactNode }) {
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
				<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
					<img
						src="/assets/defillama-dark-neutral.webp"
						alt=""
						height={WATERMARK_HEIGHT}
						width={WATERMARK_WIDTH}
						className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
					/>
					<img
						src="/assets/defillama-light-neutral.webp"
						alt=""
						height={WATERMARK_HEIGHT}
						width={WATERMARK_WIDTH}
						className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
					/>
				</div>
				{children}
			</div>
		</div>
	)
}
