import type { Row, RowData, TableFeatures } from '@tanstack/react-table'

export const percentageSortingFn = <F extends TableFeatures, T extends RowData>(
	rowA: Row<F, T>,
	rowB: Row<F, T>,
	columnId: string
): number => {
	const a = rowA.getValue<number | null | undefined>(columnId)
	const b = rowB.getValue<number | null | undefined>(columnId)

	if (a == null && b == null) {
		return 0
	}

	if (a == null) {
		return 1
	}

	if (b == null) {
		return -1
	}

	return a - b
}
