import { readSelectionFromQuery } from '~/components/Select/query'

type Query = Readonly<Record<string, string | Array<string> | undefined>>

/** The chain rows and category columns the /top-protocols pickers select. */
export function selectTopProtocolsView<TRow extends { chain: string }>(
	rows: Array<TRow>,
	chains: Array<string>,
	categories: Array<string>,
	query: Query
): { rows: Array<TRow>; columnVisibility: Record<string, boolean> } {
	const selectedChains = new Set(readSelectionFromQuery(query, 'chain', 'excludeChain', chains))
	const selectedColumns = new Set(readSelectionFromQuery(query, 'column', 'excludeColumn', categories))
	const columnVisibility: Record<string, boolean> = {}
	for (const category of categories) columnVisibility[category] = selectedColumns.has(category)
	return {
		rows: selectedChains.size === chains.length ? rows : rows.filter((row) => selectedChains.has(row.chain)),
		columnVisibility
	}
}
