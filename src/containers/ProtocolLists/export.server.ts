import { serializeCsv } from '~/utils/csv'
import type { ProtocolListKind, RecentProtocolTableRow } from './tableQuery'

export function buildProtocolListCsv(rows: Array<RecentProtocolTableRow>, kind: ProtocolListKind): string {
	const headers = [
		'Name',
		'Category',
		'TVL',
		...(kind === 'airdrops' ? ['Disclosed Money Raised', 'Undisclosed Funding Rounds'] : []),
		'Listed At',
		'1d TVL Change',
		'7d TVL Change',
		'1m TVL Change'
	]
	const values: Array<Array<string | number | null | undefined>> = [headers]
	for (const row of rows) {
		values.push([
			row.name,
			row.category,
			row.tvl,
			...(kind === 'airdrops' ? [row.raiseSummary?.totalUsd, row.raiseSummary?.undisclosedCount] : []),
			row.listedAt,
			row.change_1d,
			row.change_7d,
			row.change_1m
		])
	}
	return serializeCsv(values)
}
