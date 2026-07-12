import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

export function getYieldRowSnapshotId(row: Pick<IYieldTableRow, 'configID' | 'id' | 'pool'>): string {
	return row.configID || row.id || row.pool
}

export function indexYieldRows(rows: IYieldTableRow[]): Map<string, IYieldTableRow> {
	const byId = new Map<string, IYieldTableRow>()
	for (const row of rows) {
		for (const id of [row.configID, row.id, row.pool]) {
			if (id) byId.set(id, row)
		}
	}
	return byId
}

export function resolveYieldRowsById(rowIds: string[], rowById: ReadonlyMap<string, IYieldTableRow>): IYieldTableRow[] {
	const rows: IYieldTableRow[] = []
	for (const rowId of rowIds) {
		const row = rowId ? rowById.get(rowId) : undefined
		if (row) rows.push(row)
	}
	return rows
}

export function filterProtocolYieldRows(rows: IYieldTableRow[], protocolSlugs: string[]): IYieldTableRow[] {
	const protocolSlugSet = new Set(protocolSlugs.filter(Boolean))
	return rows.filter((row) => protocolSlugSet.has(row.projectslug))
}
