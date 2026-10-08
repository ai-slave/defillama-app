import Link from 'next/link'
import { Icon } from '~/ui/Icon'
import { type ColumnMeta, formatCellValue, getCellTone } from './previewFormatting'

export const PREVIEW_ROW_HEIGHT = 36

/** The blur and subscribe panel over a preview table's last rows. Its parent is `relative`. */
export function PreviewPaywall() {
	return (
		<>
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
				style={{
					top: '20%',
					backdropFilter: 'blur(4px)',
					WebkitBackdropFilter: 'blur(4px)',
					maskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)',
					WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)'
				}}
			/>
			<div className="absolute inset-x-0 bottom-0 z-50 border-t border-subtle bg-overlay px-6 py-5">
				<div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
					<p className="title-md text-pro-text-primary">This is a preview — subscribe to download full datasets</p>
					<p className="body-sm text-pro-text-tertiary">
						Get access to all rows, all columns, and unlimited CSV downloads
					</p>
					<Link
						href="/subscribe"
						className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand px-8 py-2.5 title-md text-on-brand shadow-md transition-all hover:opacity-90"
					>
						<Icon name="arrow-up-right" className="size-4" />
						Subscribe
					</Link>
				</div>
			</div>
		</>
	)
}

/** Filler under a preview's rows, repeating them so the paywall blurs a full-looking table. */
export function PlaceholderRows({
	columnMeta,
	gridTemplate,
	tableWidth,
	rows,
	cols
}: {
	columnMeta: Array<ColumnMeta>
	gridTemplate: string
	tableWidth: number
	rows: Array<{ values: Array<string> }>
	cols: Set<number>
}) {
	if (rows.length === 0) return null
	const duplicated = [...rows, ...rows]
	return (
		<div style={{ minWidth: `${tableWidth}px` }}>
			{duplicated.map((row, rowIdx) => {
				const isOdd = (rows.length + rowIdx) % 2 === 1
				return (
					<div
						// oxlint-disable-next-line react/no-array-index-key -- Filler intentionally repeats source rows, so source IDs would collide.
						key={`placeholder-${rowIdx}`}
						style={{ display: 'grid', gridTemplateColumns: gridTemplate, height: `${PREVIEW_ROW_HEIGHT}px` }}
					>
						{columnMeta.map((column, position) => {
							const rawValue = row.values[column.index] ?? ''
							const displayValue = formatCellValue(rawValue, column)
							const isSticky = position === 0
							const isSelected = cols.has(column.index)
							const tone = isSelected ? getCellTone(rawValue, column) : ''
							return (
								<div
									key={column.index}
									className={`truncate border-t border-r border-subtle p-2 body-md last:border-r-0 ${tone} ${!isSelected ? 'text-pro-text-tertiary opacity-40' : ''}`}
									style={{
										textAlign: column.align,
										position: isSticky ? 'sticky' : undefined,
										left: isSticky ? 0 : undefined,
										zIndex: isSticky ? 1 : undefined,
										background: isSticky ? 'var(--bg-overlay)' : isOdd ? 'var(--bg-primary)' : undefined,
										boxShadow: isSticky ? 'var(--sticky-shadow, none)' : undefined
									}}
								>
									{displayValue}
								</div>
							)
						})}
					</div>
				)
			})}
		</div>
	)
}
