import type { TiptapJson } from '../types'

function storedColumnWidths(cell: TiptapJson): Array<number> {
	const raw = cell.attrs?.colwidth
	return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) : []
}

export function tableCellAttrs(node: TiptapJson) {
	const colspan = Number(node.attrs?.colspan)
	const rowspan = Number(node.attrs?.rowspan)
	const colwidth = storedColumnWidths(node)
	return {
		colSpan: Number.isFinite(colspan) && colspan > 1 ? colspan : undefined,
		rowSpan: Number.isFinite(rowspan) && rowspan > 1 ? rowspan : undefined,
		style: colwidth.length > 0 ? { width: `${colwidth[0]}px` } : undefined
	}
}

// Columns an editor resized keep their widths only under a fixed table layout; auto layout would reflow them.
export function hasStoredColumnWidths(table: TiptapJson): boolean {
	return (table.content ?? []).some((row) => (row.content ?? []).some((cell) => storedColumnWidths(cell).length > 0))
}
