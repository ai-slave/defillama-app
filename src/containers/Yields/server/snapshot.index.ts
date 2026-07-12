import { filterTokenYieldRows } from '~/containers/Token/tokenYields.transform'
import { getYieldPoolTokenVariantSet } from '~/containers/Yields/domain/tokenFilter'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { getYieldRowSnapshotId } from './dataset.transform'

/** Pure construction of compact token-to-row-ID snapshot indexes. */
export function buildYieldsTokenIndexes(rows: IYieldTableRow[]): Map<string, string[]> {
	const rowsByToken = new Map<string, IYieldTableRow[]>()
	for (const row of rows) {
		for (const token of getYieldPoolTokenVariantSet(row.pool)) {
			const tokenRows = rowsByToken.get(token)
			if (tokenRows) tokenRows.push(row)
			else rowsByToken.set(token, [row])
		}
	}

	const indexes = new Map<string, string[]>()
	for (const [token, tokenRows] of rowsByToken) {
		indexes.set(
			token,
			Array.from(
				new Set(
					filterTokenYieldRows(tokenRows, '')
						.map(getYieldRowSnapshotId)
						.filter((rowId) => rowId.length > 0)
				)
			)
		)
	}
	return indexes
}
